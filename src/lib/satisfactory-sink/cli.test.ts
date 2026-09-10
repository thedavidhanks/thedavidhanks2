import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findRecipe, satisfactoryDataset } from './dataset.ts'

const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url))

function runCli(...args: string[]) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

const pointsOf = (stdout: string) =>
  Number(/Total sink points : ([0-9.]+)/.exec(stdout)?.[1] ?? NaN)

describe('findRecipe', () => {
  test('matches by id, exact name and loose name', () => {
    for (const query of ['alternate-iron-wire', 'Alternate: Iron Wire', 'alternate iron wire']) {
      assert.equal(findRecipe(satisfactoryDataset, query)?.id, 'alternate-iron-wire')
    }
  })

  test('tolerates a missing "Alternate:" prefix', () => {
    assert.equal(findRecipe(satisfactoryDataset, 'Iron Wire')?.id, 'alternate-iron-wire')
  })

  test('returns undefined for a name no recipe has', () => {
    assert.equal(findRecipe(satisfactoryDataset, 'Unobtainium Ingot'), undefined)
  })
})

/** The "Source products consumed" block, as a single string. */
const consumedBlock = (stdout: string) =>
  /Source products consumed:\n((?:  .*\n)*)/.exec(stdout)?.[1] ?? ''

describe('cli default mode', () => {
  // Naming several products with no quantities used to fall into ratio mode,
  // which spends its whole one-unit budget on the highest-scoring product and
  // silently drops the rest. Both cases below are real bug reports.

  test('a second product is planned for, not dropped', () => {
    const plan = runCli('motor', 'coal')
    assert.equal(plan.code, 0)

    const consumed = consumedBlock(plan.out)
    assert.match(consumed, /x Motor/)
    assert.match(consumed, /x Coal/, 'the coal used to vanish from the plan')
    // 1520 for the raw Motor, plus the coal as 1/40th of a 960-point Time
    // Crystal. Not 1522: sinking the coal raw at 2 is never the best use of it.
    assert.equal(pointsOf(plan.out), 1544)
    assert.ok(pointsOf(plan.out) > pointsOf(runCli('motor').out))
  })

  test('a third product is planned for too', () => {
    const args = ['Iron Ore', 'Coal', 'Limestone', '--alternates=Steel Rod,Solid Steel Ingot']
    const plan = runCli(...args)
    assert.equal(plan.code, 0)

    const consumed = consumedBlock(plan.out)
    for (const name of ['Iron Ore', 'Coal', 'Limestone']) {
      assert.match(consumed, new RegExp(`x ${name}`), `${name} must appear in the plan`)
    }
    assert.match(plan.out, /x Concrete/, 'the limestone should become concrete')
    // The old ratio answer was 37.8182 from iron and coal alone.
    assert.ok(pointsOf(plan.out) > 37.8182, `got ${pointsOf(plan.out)}`)
  })

  test('a single product with no quantity is still a ratio', () => {
    // The doc's worked example: --scale only does anything in ratio mode.
    const scaled = runCli('--scale=48', '--no-alternates', 'Iron Ore')
    assert.equal(scaled.code, 0)
    assert.match(consumedBlock(scaled.out), /48 x Iron Ore/)
    assert.equal(scaled.err, '')
  })

  test('--scale warns instead of silently doing nothing in fixed mode', () => {
    const scaled = runCli('--scale=48', 'Iron Ore', 'Coal')
    assert.equal(scaled.code, 0)
    assert.match(scaled.err, /--scale only applies in ratio mode/)
    assert.equal(pointsOf(scaled.out), pointsOf(runCli('Iron Ore', 'Coal').out))
  })

  test('an explicit --mode=ratio still declines a product, and reports it', () => {
    const plan = runCli('--mode=ratio', 'Mycelia', 'Leaves')
    assert.equal(plan.code, 0)
    assert.doesNotMatch(consumedBlock(plan.out), /x Leaves/)
    assert.match(plan.out, /Not worth feeding[\s\S]*Leaves/)
  })
})

describe('cli --alternates', () => {
  // Iron Ore + Coal is the doc's worked example: 22.91 points/unit with no
  // alternates, 53.65 with all of them, so a subset must land in between.
  const sources = ['Iron Ore:600', 'Coal:300']

  test('an unlocked alternate is used, and the ones left out are not', () => {
    const plan = runCli('--alternates=Solid Steel Ingot', ...sources)
    assert.equal(plan.code, 0)
    assert.match(plan.out, /Alternate: Solid Steel Ingot/)
    assert.doesNotMatch(plan.out, /Alternate: Iron Wire/)

    const none = runCli('--no-alternates', ...sources)
    const all = runCli(...sources)
    assert.ok(
      pointsOf(none.out) < pointsOf(plan.out) && pointsOf(plan.out) < pointsOf(all.out),
      `expected ${pointsOf(none.out)} < ${pointsOf(plan.out)} < ${pointsOf(all.out)}`,
    )
  })

  test('an empty list matches --no-alternates', () => {
    const empty = runCli('--alternates=', ...sources)
    assert.equal(empty.code, 0)
    assert.equal(pointsOf(empty.out), pointsOf(runCli('--no-alternates', ...sources).out))
  })

  test('the flag is repeatable and commas split', () => {
    const twice = runCli('--alternates=Iron Wire', '--alternates=Solid Steel Ingot', ...sources)
    const once = runCli('--alternates=Iron Wire,Solid Steel Ingot', ...sources)
    assert.equal(twice.code, 0)
    assert.equal(pointsOf(twice.out), pointsOf(once.out))
  })

  test('--alternates-file reads names, comments and blank lines', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'sink-')), 'unlocked.txt')
    writeFileSync(path, '# my save\n\nIron Wire\nSolid Steel Ingot  # from a hard drive\n')
    const fromFile = runCli(`--alternates-file=${path}`, ...sources)
    const fromFlag = runCli('--alternates=Iron Wire,Solid Steel Ingot', ...sources)
    assert.equal(fromFile.code, 0)
    assert.equal(pointsOf(fromFile.out), pointsOf(fromFlag.out))
  })

  test('rejects an unknown recipe, a standard recipe, and --no-alternates together', () => {
    const unknown = runCli('--alternates=Unobtainium Ingot', ...sources)
    assert.equal(unknown.code, 1)
    assert.match(unknown.err, /Unknown recipe/)

    const standard = runCli('--alternates=Screws', ...sources)
    assert.equal(standard.code, 1)
    assert.match(standard.err, /not an alternate recipe/)

    const both = runCli('--alternates=Iron Wire', '--no-alternates', ...sources)
    assert.equal(both.code, 1)
    assert.match(both.err, /not both/)
  })

  test('--alternates-file reports a missing file instead of throwing', () => {
    const missing = runCli('--alternates-file=/nonexistent/unlocked.txt', ...sources)
    assert.equal(missing.code, 1)
    assert.match(missing.err, /Could not read alternates file/)
  })

  test('--list-alternates prints only alternates', () => {
    const listed = runCli('--list-alternates')
    assert.equal(listed.code, 0)
    const alternates = satisfactoryDataset.recipes.filter((recipe) => recipe.alternate)
    const lines = listed.out.trim().split('\n')
    assert.equal(lines.length, alternates.length)
    // Not every alternate is named "Alternate: ..." - Turbofuel is not - so
    // check membership rather than the prefix.
    const names = new Set(alternates.map((recipe) => recipe.name))
    assert.ok(lines.every((line) => names.has(line)))
  })
})
