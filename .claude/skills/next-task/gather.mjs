#!/usr/bin/env node
// Collects everything the next-task skill ranks on and prints it as JSON.
// Deterministic parts (tiers, date order, blocker chain, WIP scan) live here;
// judgment calls are left to SKILL.md.
//
// Usage: node .claude/skills/next-task/gather.mjs [--no-fetch] [--top=8]

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const TOP = Number(args.find((a) => a.startsWith('--top='))?.slice(6) ?? 8);
const BASE = 'origin/dev';
const TIER = { security: 0, stuckDependabot: 1, normal: 2 };

const run = (cmd, argv) =>
  execFileSync(cmd, argv, {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const gh = (...a) => run('gh', a);
const ghJson = (...a) => JSON.parse(gh(...a) || 'null');
const git = (...a) => run('git', a);
const attempt = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const warnings = [];
const repo = ghJson('repo', 'view', '--json', 'nameWithOwner').nameWithOwner;

if (!args.includes('--no-fetch')) {
  attempt(() => git('fetch', '--prune', '--quiet', 'origin'), null) ??
    warnings.push('git fetch failed; branch data may be stale');
}

// ------------------------------------------------------------ raw data

const issues = ghJson(
  'issue', 'list', '--repo', repo, '--state', 'open', '--limit', '300',
  '--json', 'number,title,labels,createdAt,body,url',
);
const openNumbers = new Set(issues.map((i) => i.number));

const openPrs = ghJson(
  'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100',
  '--json', 'number,title,url,createdAt,baseRefName,headRefName,isDraft,author,closingIssuesReferences,statusCheckRollup',
);

const alerts = attempt(
  () => ghJson('api', '--paginate', `repos/${repo}/dependabot/alerts?state=open&per_page=100`),
  null,
);
if (!alerts) warnings.push('Dependabot alerts unreadable; Dependabot security detected by text only');

const devLock = attempt(() => JSON.parse(git('show', `${BASE}:package-lock.json`)), null);

// ------------------------------------------------------------ helpers

// Bare "security" is deliberately not a signal: "Firestore security rules"
// shows up in ordinary feature issues (#78).
const SECURITY_TEXT =
  /\bGHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}\b|\bCVE-\d{4}-\d{4,}\b|\bvulnerab\w*|\bsecurity advisor(?:y|ies)\b|\bexploit\w*/i;
const BLOCKER_TEXT = /\b(?:blocked\s+by|depends\s+on)\b[:\s]*((?:#\d+(?:\s*(?:,|and|&)\s*)?)+)/gi;
const DEPENDABOT_MARKER = /<!--\s*dependabot-automation:pr-(\d+)\s*-->/;
const CITED_FILE = /\b((?:src|scripts|docs|public|\.github)\/[\w./-]+|[\w-]+\.(?:rules|ya?ml|json))\b/g;
const SKIP_LABELS = new Set(['wontfix', 'duplicate', 'invalid']);

const cmpVersion = (a, b) => {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

const lockVersions = (pkg) =>
  devLock
    ? Object.entries(devLock.packages ?? {})
        .filter(([path]) => path === `node_modules/${pkg}` || path.endsWith(`/node_modules/${pkg}`))
        .map(([, meta]) => meta.version)
    : [];

// "chore(deps): bump undici from 8.11.2 to 8.12.3" -> package facts.
function bumpInfo(title) {
  const m = /bump (\S+) from (\S+) to (\S+)/i.exec(title ?? '');
  if (!m) return { pkg: null, target: null, devVersions: [], resolved: false, alerts: [] };
  const [, pkg, , target] = m;
  const devVersions = lockVersions(pkg);
  return {
    pkg,
    target,
    devVersions,
    resolved: devVersions.length > 0 && devVersions.every((v) => cmpVersion(v, target) >= 0),
    alerts: (alerts ?? [])
      .filter((a) => a.dependency?.package?.name === pkg)
      .map((a) => `${a.security_advisory.ghsa_id} (${a.security_advisory.severity})`),
  };
}

// ------------------------------------------------- stuck Dependabot PRs
//
// dependabot-to-dev.yml runs daily and calls dependabot-one.yml once per open
// Dependabot PR against master, as jobs named "process (<pr>) / <job>". On
// success that workflow closes the master PR and raises a dev PR, so a PR that
// is still open against master after a completed run processed it did not
// land. A rebase conflict does not fail any job (prepare and finalize succeed,
// verify is skipped), so "still open after processing" is the real signal and
// job conclusions only explain why.

const dependabotPrs = openPrs.filter(
  (pr) => pr.baseRefName === 'master' && /dependabot/i.test(pr.author?.login ?? ''),
);

const runs = dependabotPrs.length
  ? attempt(
      () =>
        ghJson(
          'run', 'list', '--repo', repo, '--workflow', 'dependabot-to-dev.yml', '--limit', '15',
          '--json', 'databaseId,createdAt,status,conclusion,url',
        ).filter((r) => r.status === 'completed'),
      [],
    )
  : [];
const jobsByRun = new Map();
const runJobs = (id) => {
  if (!jobsByRun.has(id)) {
    jobsByRun.set(
      id,
      attempt(() => ghJson('api', `repos/${repo}/actions/runs/${id}/jobs?per_page=100`).jobs, []),
    );
  }
  return jobsByRun.get(id);
};

function lastAttempt(prNumber) {
  const prefix = `process (${prNumber}) / `;
  for (const r of runs) {
    const jobs = runJobs(r.databaseId).filter((j) => j.name.startsWith(prefix));
    if (jobs.length === 0) continue;
    const result = Object.fromEntries(jobs.map((j) => [j.name.slice(prefix.length), j.conclusion]));
    const outcome = Object.values(result).includes('failure')
      ? 'job-failed'
      : result.verify === 'skipped'
        ? 'rebase-conflict'
        : 'not-landed';
    return { runUrl: r.url, date: r.createdAt.slice(0, 10), jobs: result, outcome };
  }
  return null;
}

const failingChecks = (pr) =>
  (pr.statusCheckRollup ?? [])
    .filter((c) => ['FAILURE', 'ERROR', 'TIMED_OUT'].includes(c.conclusion ?? c.state))
    .map((c) => c.name ?? c.context);

const stuck = new Map();
const pendingDependabot = [];
for (const pr of dependabotPrs) {
  const attemptInfo = lastAttempt(pr.number);
  const info = {
    pr: pr.number,
    title: pr.title,
    url: pr.url,
    createdAt: pr.createdAt,
    failingChecks: failingChecks(pr),
    lastAttempt: attemptInfo,
    ...bumpInfo(pr.title),
  };
  if (attemptInfo || info.failingChecks.length) stuck.set(pr.number, info);
  else pendingDependabot.push({ pr: pr.number, title: pr.title, note: 'automation has not processed it yet' });
}

// ------------------------------------------------------------ records

function nativeBlockers(n) {
  const list = attempt(() => ghJson('api', `repos/${repo}/issues/${n}/dependencies/blocked_by`), []);
  return (list ?? []).filter((b) => b.state === 'open').map((b) => b.number);
}

function textBlockers(body) {
  const found = new Set();
  for (const m of body.matchAll(BLOCKER_TEXT)) {
    for (const ref of m[1].matchAll(/#(\d+)/g)) found.add(Number(ref[1]));
  }
  return [...found];
}

const trackedPrs = new Set();
const records = issues.map((issue) => {
  const body = issue.body ?? '';
  const labels = issue.labels.map((l) => l.name);

  // Tracking issue filed by dependabot-one.yml when a bump could not land.
  const trackedPr = Number(DEPENDABOT_MARKER.exec(body)?.[1]) || null;
  let dependabot = null;
  if (trackedPr) {
    trackedPrs.add(trackedPr);
    const view = attempt(
      () => ghJson('pr', 'view', String(trackedPr), '--repo', repo, '--json', 'state,title'),
      null,
    );
    dependabot = stuck.get(trackedPr) ?? {
      pr: trackedPr,
      prState: view?.state ?? 'UNKNOWN',
      ...bumpInfo(view?.title),
    };
  }

  const securitySources = [];
  if (labels.includes('security')) securitySources.push('label');
  const textHit = SECURITY_TEXT.exec(`${issue.title}\n${body}`);
  if (textHit) securitySources.push(`text:${textHit[0]}`);
  if (dependabot?.alerts.length) securitySources.push(`dependabot-alert:${dependabot.alerts.join(',')}`);

  const blockedBy = [];
  for (const n of nativeBlockers(issue.number)) blockedBy.push({ number: n, via: 'native' });
  for (const n of textBlockers(body)) {
    if (n !== issue.number && openNumbers.has(n) && !blockedBy.some((b) => b.number === n)) {
      blockedBy.push({ number: n, via: 'text' });
    }
  }

  const prs = openPrs
    .filter(
      (pr) =>
        pr.closingIssuesReferences?.some((r) => r.number === issue.number) ||
        new RegExp(`(?:^|[-_/])(?:issue-)?${issue.number}$`).test(pr.headRefName),
    )
    .map((pr) => ({ number: pr.number, branch: pr.headRefName, draft: pr.isDraft }));

  return {
    kind: 'issue',
    number: issue.number,
    title: issue.title,
    url: issue.url,
    createdAt: issue.createdAt,
    labels,
    securitySources,
    tier: securitySources.length
      ? TIER.security
      : trackedPr && stuck.has(trackedPr)
        ? TIER.stuckDependabot
        : TIER.normal,
    blockedBy,
    openPrs: prs,
    dependabot,
    citedFiles: [...new Set([...body.matchAll(CITED_FILE)].map((m) => m[1]))],
  };
});

// Stuck PRs with no tracking issue (e.g. the issue step itself failed) are
// candidates in their own right.
for (const info of stuck.values()) {
  if (trackedPrs.has(info.pr)) continue;
  records.push({
    kind: 'dependabot-pr',
    number: info.pr,
    title: info.title,
    url: info.url,
    createdAt: info.createdAt,
    labels: [],
    securitySources: info.alerts.length ? [`dependabot-alert:${info.alerts.join(',')}`] : [],
    tier: info.alerts.length ? TIER.security : TIER.stuckDependabot,
    blockedBy: [],
    openPrs: [],
    dependabot: info,
    citedFiles: ['package.json', 'package-lock.json'],
  });
}

// ------------------------------------------------------------ ranking

const skipped = [];
const actionable = records.filter((r) => {
  const skipLabel = r.labels.find((l) => SKIP_LABELS.has(l));
  if (skipLabel) return skipped.push({ number: r.number, reason: `label:${skipLabel}` }) && false;
  if (r.dependabot?.resolved) {
    return skipped.push({
      number: r.number,
      reason: `stale: dev already has ${r.dependabot.pkg}@${r.dependabot.devVersions.join('/')} >= ${r.dependabot.target}`,
    }) && false;
  }
  return true;
});

actionable.sort((a, b) => a.tier - b.tier || a.createdAt.localeCompare(b.createdAt));
const rankOf = new Map(actionable.map((r, i) => [r.number, i]));
const byNumber = new Map(records.map((r) => [r.number, r]));

// Walk blockers from the top item; at each fork take the highest-ranked
// blocker. Blockers filtered out of `actionable` still count, since an open
// issue blocks regardless of how we would rank it.
function resolveChain(start) {
  const chain = [start];
  for (;;) {
    const current = byNumber.get(chain.at(-1));
    const open = current.blockedBy
      .map((b) => b.number)
      .filter((n) => byNumber.has(n))
      .sort((x, y) => (rankOf.get(x) ?? Infinity) - (rankOf.get(y) ?? Infinity));
    if (open.length === 0) return { number: chain.at(-1), chain };
    const next = open.find((n) => !chain.includes(n));
    if (next === undefined) return { number: null, chain, cycle: [...chain, open[0]] };
    chain.push(next);
  }
}

const pick = actionable.length ? resolveChain(actionable[0].number) : null;
const pickRecord = pick?.number ? byNumber.get(pick.number) : null;

// ------------------------------------------------------------ WIP

const currentBranch = attempt(() => git('branch', '--show-current'), '');
const dirty = attempt(() => git('status', '--porcelain'), '').split('\n').filter(Boolean);

const IGNORED_BRANCH = /^(?:origin\/)?(?:HEAD|dev|master|dependabot\/.*|automation\/.*)$|^origin$/;
const refs = git(
  'for-each-ref',
  '--format=%(refname:short)\t%(upstream:short)\t%(committerdate:short)',
  'refs/heads',
  'refs/remotes/origin',
)
  .split('\n')
  .map((line) => line.split('\t'))
  .filter(([name]) => !IGNORED_BRANCH.test(name));

const trackedUpstreams = new Set(refs.map(([, upstream]) => upstream).filter(Boolean));
const pickFiles = new Set(pickRecord?.citedFiles ?? []);

const wip = [];
const patchMerged = [];
for (const [name, , date] of refs) {
  if (trackedUpstreams.has(name)) continue; // the local branch already covers it
  const ahead = Number(attempt(() => git('rev-list', '--count', `${BASE}..${name}`), '0'));
  if (ahead === 0) continue;
  // git cherry marks commits already on dev (by patch-id) with "-", which
  // catches squash- and cherry-pick-merged branches that --no-merged misses.
  const unique = attempt(() => git('cherry', BASE, name), '')
    .split('\n')
    .filter((l) => l.startsWith('+')).length;
  if (unique === 0) {
    patchMerged.push(name);
    continue;
  }
  const behind = Number(attempt(() => git('rev-list', '--count', `${name}..${BASE}`), '0'));
  const log = attempt(() => git('log', '--format=%s%n%b', `${BASE}..${name}`), '');
  const nameRef = /(?:^|[-_/])(?:issue-)?(\d+)$/.exec(name)?.[1];
  const issueRefs = [
    ...new Set([nameRef, ...[...log.matchAll(/#(\d+)/g)].map((m) => m[1])].filter(Boolean).map(Number)),
  ].filter((n) => openNumbers.has(n));
  const files = attempt(() => git('diff', '--name-only', `${BASE}...${name}`), '')
    .split('\n')
    .filter(Boolean);
  wip.push({
    branch: name,
    lastCommit: date,
    ahead,
    unique,
    behind,
    openIssueRefs: issueRefs,
    openPr: openPrs.find((pr) => name.replace(/^origin\//, '') === pr.headRefName)?.number ?? null,
    filesChanged: files.length,
    overlapWithPick: files.filter((f) => pickFiles.has(f)),
  });
}
wip.sort((a, b) => b.lastCommit.localeCompare(a.lastCommit));

// ------------------------------------------------------------ output

const TIER_NAME = Object.fromEntries(Object.entries(TIER).map(([k, v]) => [v, k]));
const summarize = (r) => ({
  kind: r.kind,
  number: r.number,
  title: r.title,
  tier: TIER_NAME[r.tier],
  createdAt: r.createdAt.slice(0, 10),
  ...(r.securitySources.length && { security: r.securitySources }),
  ...(r.blockedBy.length && { blockedBy: r.blockedBy }),
  ...(r.openPrs.length && { openPrs: r.openPrs }),
  ...(r.dependabot && { dependabot: r.dependabot }),
});

console.log(
  JSON.stringify(
    {
      repo,
      base: BASE,
      generatedAt: new Date().toISOString(),
      warnings,
      workingTree: { branch: currentBranch, dirty },
      pick: pick && {
        ...pick,
        item: pickRecord && { ...summarize(pickRecord), url: pickRecord.url, citedFiles: [...pickFiles] },
      },
      ranked: actionable.slice(0, TOP).map(summarize),
      totalActionable: actionable.length,
      skipped,
      pendingDependabot,
      hygiene: {
        securityWithoutLabel: records
          .filter((r) => r.kind === 'issue' && r.securitySources.length && !r.labels.includes('security'))
          .map((r) => ({ number: r.number, why: r.securitySources })),
        patchMergedBranches: patchMerged,
      },
      wip,
    },
    null,
    2,
  ),
);
