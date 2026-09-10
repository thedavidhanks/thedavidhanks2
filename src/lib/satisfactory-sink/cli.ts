/**
 * Command-line runner.
 *
 *   node src/lib/satisfactory-sink/cli.ts "Iron Ore"
 *   node src/lib/satisfactory-sink/cli.ts "Iron Ore:600" "Coal:300"
 *   node src/lib/satisfactory-sink/cli.ts --scale=12 "Iron Ore"
 *
 * Product syntax: "Name[:quantity][@weight]".
 * A single product with no quantity gets ratio mode (unlimited supply, best
 * mix); anything else gets fixed mode, defaulting a missing quantity to 1.
 */
import { readFileSync } from 'node:fs'
import { satisfactoryDataset, findItem, findRecipe } from './dataset.ts'
import { maximizeSinkPoints, formatPlan, resolveMode } from './maximize.ts'
import type { SolveMode, SourceProduct } from './types.ts'

const USAGE = `Maximize AWESOME Sink points for a set of source products.

Usage:
  node src/lib/satisfactory-sink/cli.ts [options] "<Product>[:qty][@weight]" ...

Options:
  --mode=fixed|ratio   fixed: maximize total points for the given quantities.
                       ratio: unlimited supply, maximize points per source unit.
                       Default: ratio for a single product with no quantity,
                       fixed otherwise (a missing quantity counts as 1).
  --scale=N            In ratio mode, print the plan scaled to N source units.
  --no-alternates      Ignore alternate recipes, which need Hard Drive unlocks.
  --alternates=A,B     Allow only these alternate recipes - the ones your save
                       has unlocked. Every other alternate is ignored; standard
                       recipes are always available. Repeatable. The
                       "Alternate:" prefix is optional.
  --alternates-file=F  Same, but read the names from a file, one per line
                       (commas also split, "#" starts a comment).
  --json               Emit the raw plan as JSON.
  --list               List the products in the dataset and exit.
  --list-alternates    List the alternate recipes in the dataset and exit.
  --help

Examples:
  node src/lib/satisfactory-sink/cli.ts "Iron Ore"
  node src/lib/satisfactory-sink/cli.ts "Iron Ore:600" "Coal:300"
  node src/lib/satisfactory-sink/cli.ts --mode=ratio "Coal" "Sulfur"
  node src/lib/satisfactory-sink/cli.ts --alternates="Iron Wire,Cast Screws" "Iron Ore"
  node src/lib/satisfactory-sink/cli.ts --alternates-file=my-save.txt "Iron Ore"`

/** Split a comma/newline separated list, dropping "#" comments and blanks. */
function splitList(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.split('#')[0])
    .join(',')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function main(argv: string[]): number {
  let dataset = satisfactoryDataset
  const positional: string[] = []
  let mode: SolveMode | undefined
  let scaleTo: number | undefined
  let asJson = false
  let noAlternates = false
  // `undefined` means "every alternate is unlocked"; a list means "only these".
  let unlockedAlternates: string[] | undefined

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      return 0
    }
    if (arg === '--list') {
      for (const item of dataset.items) {
        const points = item.sinkPoints == null ? 'cannot be sunk' : `${item.sinkPoints} pts`
        console.log(`${item.name.padEnd(26)} ${points}`)
      }
      return 0
    }
    if (arg === '--list-alternates') {
      for (const recipe of dataset.recipes) {
        if (recipe.alternate) console.log(recipe.name)
      }
      return 0
    }
    if (arg === '--json') {
      asJson = true
    } else if (arg === '--no-alternates') {
      noAlternates = true
    } else if (arg.startsWith('--alternates=')) {
      const names = splitList(arg.slice('--alternates='.length))
      unlockedAlternates = [...(unlockedAlternates ?? []), ...names]
    } else if (arg.startsWith('--alternates-file=')) {
      const path = arg.slice('--alternates-file='.length)
      let contents: string
      try {
        contents = readFileSync(path, 'utf8')
      } catch {
        console.error(`Could not read alternates file "${path}".`)
        return 1
      }
      unlockedAlternates = [...(unlockedAlternates ?? []), ...splitList(contents)]
    } else if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length)
      if (value !== 'fixed' && value !== 'ratio') {
        console.error(`Unknown mode: ${value}`)
        return 1
      }
      mode = value
    } else if (arg.startsWith('--scale=')) {
      scaleTo = Number(arg.slice('--scale='.length))
      if (!Number.isFinite(scaleTo) || scaleTo <= 0) {
        console.error('--scale must be a positive number')
        return 1
      }
    } else if (arg.startsWith('--')) {
      console.error(`Unknown option: ${arg}`)
      return 1
    } else {
      positional.push(arg)
    }
  }

  if (noAlternates && unlockedAlternates !== undefined) {
    console.error('Use either --no-alternates or --alternates/--alternates-file, not both.')
    return 1
  }

  if (positional.length === 0) {
    console.log(USAGE)
    return 1
  }

  if (noAlternates) {
    dataset = { ...dataset, recipes: dataset.recipes.filter((recipe) => !recipe.alternate) }
  } else if (unlockedAlternates !== undefined) {
    // Resolve names against the alternates first, so "Iron Wire" reaches
    // "Alternate: Iron Wire" even when a standard recipe matches as loosely.
    const alternates = { ...dataset, recipes: dataset.recipes.filter((recipe) => recipe.alternate) }
    const unlocked = new Set<string>()
    for (const name of unlockedAlternates) {
      const recipe = findRecipe(alternates, name) ?? findRecipe(dataset, name)
      if (!recipe) {
        console.error(`Unknown recipe "${name}". Run with --list-alternates to see valid names.`)
        return 1
      }
      if (!recipe.alternate) {
        console.error(
          `"${recipe.name}" is not an alternate recipe - standard recipes are always available.`,
        )
        return 1
      }
      unlocked.add(recipe.id)
    }
    dataset = {
      ...dataset,
      recipes: dataset.recipes.filter((recipe) => !recipe.alternate || unlocked.has(recipe.id)),
    }
  }

  const sources: SourceProduct[] = []
  for (const token of positional) {
    const match = /^([^:@]+)(?::([0-9.]+))?(?:@([0-9.]+))?$/.exec(token.trim())
    if (!match) {
      console.error(`Could not parse product "${token}". Expected "Name[:qty][@weight]".`)
      return 1
    }
    const item = findItem(dataset, match[1])
    if (!item) {
      console.error(`Unknown product "${match[1]}". Run with --list to see valid names.`)
      return 1
    }
    sources.push({
      item: item.id,
      quantity: match[2] === undefined ? undefined : Number(match[2]),
      weight: match[3] === undefined ? undefined : Number(match[3]),
    })
  }

  if (scaleTo !== undefined && resolveMode(sources, mode) === 'fixed') {
    console.error('--scale only applies in ratio mode; ignoring it.')
  }

  const plan = maximizeSinkPoints({ dataset, sources, mode, scaleTo })
  console.log(asJson ? JSON.stringify(plan, null, 2) : formatPlan(plan))
  return plan.status === 'optimal' ? 0 : 1
}

process.exitCode = main(process.argv.slice(2))
