/**
 * Command-line runner.
 *
 *   node src/lib/satisfactory-sink/cli.ts "Iron Ore"
 *   node src/lib/satisfactory-sink/cli.ts "Iron Ore:600" "Coal:300"
 *   node src/lib/satisfactory-sink/cli.ts --scale=12 "Iron Ore"
 *
 * Product syntax: "Name[:quantity][@weight]".
 * Omit every quantity to get ratio mode (unlimited supply, best mix).
 */
import { satisfactoryDataset, findItem } from './dataset.ts'
import { maximizeSinkPoints, formatPlan } from './maximize.ts'
import type { SolveMode, SourceProduct } from './types.ts'

const USAGE = `Maximize AWESOME Sink points for a set of source products.

Usage:
  node src/lib/satisfactory-sink/cli.ts [options] "<Product>[:qty][@weight]" ...

Options:
  --mode=fixed|ratio   fixed: maximize total points for the given quantities.
                       ratio: unlimited supply, maximize points per source unit.
                       Default: fixed if every product has a quantity, else ratio.
  --scale=N            In ratio mode, print the plan scaled to N source units.
  --no-alternates      Ignore alternate recipes, which need Hard Drive unlocks.
  --json               Emit the raw plan as JSON.
  --list               List the products in the dataset and exit.
  --help

Examples:
  node src/lib/satisfactory-sink/cli.ts "Iron Ore"
  node src/lib/satisfactory-sink/cli.ts "Iron Ore:600" "Coal:300"
  node src/lib/satisfactory-sink/cli.ts --mode=ratio "Coal" "Sulfur"`

function main(argv: string[]): number {
  let dataset = satisfactoryDataset
  const positional: string[] = []
  let mode: SolveMode | undefined
  let scaleTo: number | undefined
  let asJson = false
  let noAlternates = false

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
    if (arg === '--json') {
      asJson = true
    } else if (arg === '--no-alternates') {
      noAlternates = true
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

  if (positional.length === 0) {
    console.log(USAGE)
    return 1
  }

  if (noAlternates) {
    dataset = { ...dataset, recipes: dataset.recipes.filter((recipe) => !recipe.alternate) }
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

  const plan = maximizeSinkPoints({ dataset, sources, mode, scaleTo })
  console.log(asJson ? JSON.stringify(plan, null, 2) : formatPlan(plan))
  return plan.status === 'optimal' ? 0 : 1
}

process.exitCode = main(process.argv.slice(2))
