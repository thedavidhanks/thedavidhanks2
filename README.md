## Thedavidhanks
[TheDavidHanks.com](https://thedavidhanks.com)  - 
A site about me.  
Auto-deployed using AWS amplify (us-west-2) on changes to master branch.  

## Testing locally

* Create .env file in the root of the project with VITE_FIREBASE_API_KEY=[key_here]
** API key can be found in console.firebase.google.com > thedavidhanks > project settings > general > Web API Key  

to start, run
```
npm install
npm run dev
```

## Satisfactory AWESOME Sink optimizer

A calculator that works out what to build from a set of raw products so the
AWESOME Sink pays as much as possible. Explained in full in
[docs/satisfactory-sink-maximizer.md](docs/satisfactory-sink-maximizer.md).

```
npm run sink -- "Iron Ore"          # best use of one product
npm run sink -- "Coal:600" "Sulfur:100"   # best use of fixed amounts
npm run sink -- --help              # all options
npm run test:sink                   # run its tests
```

### Updating the item and recipe data after a game patch

The optimizer reads two files, [src/data/satisfactory/items.json](src/data/satisfactory/items.json)
(how many points each item is worth) and
[src/data/satisfactory/recipes.json](src/data/satisfactory/recipes.json) (what
turns into what). **Do not edit them by hand.** They are generated from a file
that ships with the game, by
[scripts/build-satisfactory-data.ts](scripts/build-satisfactory-data.ts).

When Coffee Stain patches the game, the numbers change. Here is the whole
process.

**Step 1 — Find the game's data file.** Satisfactory ships a machine-readable
list of every item and recipe. It is inside your game install:

| Platform | Where to look |
| --- | --- |
| Steam (Windows) | `C:\Program Files (x86)\Steam\steamapps\common\Satisfactory\CommunityResources\Docs\en-US.json` |
| Steam (other library) | In Steam, right-click Satisfactory → Manage → **Browse local files**, then open `CommunityResources\Docs\` |
| Epic Games | `C:\Program Files\Epic Games\Satisfactory\CommunityResources\Docs\en-US.json` |

The file is around 11 MB. If you see several files in `Docs\`, take `en-US.json`.

**Step 2 — Copy it into `resources/`.** From the repo root, the file must end up
at exactly `resources/en-US.json`:

```
thedavidhanks/
  resources/
    en-US.json     <-- here
```

Create the `resources` folder if it does not exist. The file is deliberately
excluded from git (it is large, and it is Coffee Stain's content), so it will
not show up in your commits — that is expected.

**Step 3 — Run the generator.**

```
npm run data:satisfactory
```

You should see something like:

```
Satisfactory 1.1 <- /workspaces/thedavidhanks/resources/en-US.json
  items   186 (154 sinkable)  -> src/data/satisfactory/items.json
  recipes 291 (110 alternate) -> src/data/satisfactory/recipes.json
```

If the game version changed, say the patch took the game to 1.2, tell it so —
otherwise the files keep claiming they came from the old version:

```
npm run data:satisfactory -- --game-version=1.2
```

**Step 4 — Check nothing broke.**

```
npm run test:sink
```

All tests should pass. These are not just tests of the maths — several of them
check the *data*, so a failure here usually means the patch changed something
structural and the generator needs updating, not that your computer is broken.

**Step 5 — Look at the diff.** `git diff src/data/satisfactory/` shows exactly
which point values and recipes moved. The generator sorts everything and writes
no timestamps, so if the patch changed nothing relevant you will see **no diff
at all** — that is a valid result, not a failed run.

Then commit `src/data/satisfactory/*.json` as normal.

#### Verifying the data is current

To check whether the committed data matches the export in `resources/` without
changing any files:

```
npm run data:satisfactory:check
```

It prints `up to date`, or `STALE: regenerate with npm run data:satisfactory`
and exits with an error code (useful in CI).

To spot-check a single value by hand, compare against the wiki — for example
[AWESOME Sink](https://satisfactory.wiki.gg/wiki/AWESOME_Sink) — and list what
the optimizer currently believes:

```
npm run sink -- --list
```

Note that the wiki is itself generated from this same game file, so if the two
disagree, the game file is the authority.

#### If something goes wrong

| Message | What it means |
| --- | --- |
| `Cannot read .../resources/en-US.json` | Step 2 was missed, or the file is named differently. It must be exactly `resources/en-US.json`. |
| `... is not valid JSON` | The file got mangled, usually by opening and re-saving it in an editor. Re-copy a fresh one from the game folder. |
| `... is JSON but not the game's docs export` | Wrong file was copied. You want `en-US.json` from `CommunityResources\Docs\`. |
| `skipped Recipe_...: references unknown item ...` | A warning, not a failure. That one recipe was left out because the patch introduced something the generator does not understand. The rest of the data is fine, but show a developer. |
| The item or recipe count drops sharply | The patch renamed something structural. The run "succeeded" but the data is incomplete — show a developer rather than committing it. |
| Tests fail after regenerating | The patch changed the data's shape. Also a developer job — the failing test name says what assumption broke. |

You never need TypeScript installed. Node 22+ runs these `.ts` files directly.