#!/usr/bin/env bash
# Runs once, on container create (onCreateCommand).
set -euo pipefail

WORKSPACE="${1:-/workspaces/thedavidhanks}"
HOST_CLAUDE=/home/node/.claude-host
CLAUDE=/home/node/.claude

# Named volumes are created root-owned.
sudo chown -R node:node \
  "$WORKSPACE/node_modules" \
  "$CLAUDE" \
  /home/node/.config/gcloud \
  /home/node/.config/gh

if [ -d "$HOST_CLAUDE" ]; then
  # Portable, platform-independent config -- symlinked so edits on the host
  # show up in the container without a rebuild. Read-only from in here.
  for item in skills agents commands CLAUDE.md; do
    [ -e "$HOST_CLAUDE/$item" ] && ln -sfn "$HOST_CLAUDE/$item" "$CLAUDE/$item"
  done

  # settings.json must be a copy, not a link: Claude Code writes to it, and the
  # host mount is read-only. It carries enabledPlugins + extraKnownMarketplaces,
  # so plugins re-install themselves from git on first launch.
  [ -f "$CLAUDE/settings.json" ] || cp "$HOST_CLAUDE/settings.json" "$CLAUDE/settings.json"
else
  echo "warning: $HOST_CLAUDE not mounted; starting with an empty Claude config" >&2
fi
