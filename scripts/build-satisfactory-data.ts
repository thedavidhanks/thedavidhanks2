#!/usr/bin/env node
/**
 * Regenerates src/data/satisfactory/{items,recipes}.json from the game's own
 * documentation export.
 *
 * The source file ships with every Satisfactory install at
 *   <SteamLibrary>/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json
 * It is UTF-16LE with a BOM, and every value inside it is a string -- numbers,
 * booleans, and the ingredient lists are all stringly-typed Unreal property
 * dumps that have to be parsed out.
 *
 * Usage:
 *   node scripts/build-satisfactory-data.ts [--input=PATH] [--game-version=X.Y] [--check]
 *
 * Run with no arguments after dropping a new en-US.json into resources/.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

/** Unreal building class -> the name players know it by. */
const MACHINES: Record<string, string> = {
  Build_SmelterMk1: 'Smelter',
  Build_FoundryMk1: 'Foundry',
  Build_ConstructorMk1: 'Constructor',
  Build_AssemblerMk1: 'Assembler',
  Build_ManufacturerMk1: 'Manufacturer',
  Build_OilRefinery: 'Refinery',
  Build_Packager: 'Packager',
  Build_Blender: 'Blender',
  Build_HadronCollider: 'Particle Accelerator',
  Build_Converter: 'Converter',
  Build_QuantumEncoder: 'Quantum Encoder',
}

/**
 * The AWESOME Sink has a conveyor input and no pipe input, so no fluid can be
 * sunk no matter how many points the game data assigns it. Everything else the
 * game marks as unsinkable already carries mResourceSinkPoints = 0.
 */
const SINKABLE_FORMS = new Set(['RF_SOLID'])

const ITEMS_NOTE =
  'sinkPoints: null means the item cannot be fed to the AWESOME Sink. ' +
  'Fluids and gases are null because the Sink has a conveyor input and no pipe input ' +
  '(their packaged forms are sinkable); everything else that is null carries ' +
  'mResourceSinkPoints = 0 in the game data -- alien remains and protein, consumable ' +
  'mushrooms/nuts/berries, Power Slugs and Shards, Mercer Spheres, Somersloops, and ' +
  'Uranium/Plutonium Waste and their derivatives. Ammo, equipment and plain Uranium ARE sinkable.'

const RECIPES_NOTE =
  'Only recipes that run in an automated production building are included; ' +
  'build-gun (construction) and hand-crafting-only recipes are dropped. ' +
  'Fluid and gas quantities are in m3 -- the game data stores them in cm3 (x1000).'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type RawClass = Record<string, string>
type RawGroup = { NativeClass: string; Classes: RawClass[] }

type OutItem = {
  id: string
  name: string
  className: string
  sinkPoints: number | null
  form: string
  category: string
  disposable?: boolean
}

type OutRecipe = {
  id: string
  name: string
  className: string
  machine: string
  duration: number
  alternate?: boolean
  inputs: { item: string; quantity: number }[]
  outputs: { item: string; quantity: number }[]
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The docs file is UTF-16LE with a BOM. Decode by BOM rather than by assuming,
 * so a re-encoded copy still works.
 */
function decode(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf[0] === 0xfe && buf[1] === 0xff) throw new Error('UTF-16BE input is not supported')
  return buf.toString('utf8').replace(/^﻿/, '')
}

/** `Texture2D /Game/.../Desc_IronPlate.Desc_IronPlate_C'` -> `Desc_IronPlate_C` */
function classNameFromPath(path: string): string | null {
  const m = path.match(/([A-Za-z0-9_]+_C)'?$/)
  return m ? m[1] : null
}

/**
 * Parses `((ItemClass="...Desc_IronPlate_C'",Amount=6),(...))` into pairs.
 * Amount is an integer count for solids and cm3 for fluids.
 */
function parseIngredients(raw: string): { className: string; amount: number }[] {
  const out: { className: string; amount: number }[] = []
  const re = /ItemClass="([^"]+)"\s*,\s*Amount=([0-9.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const className = classNameFromPath(m[1])
    if (!className) throw new Error(`could not read item class from ${m[1]}`)
    out.push({ className, amount: Number(m[2]) })
  }
  return out
}

function machineFor(producedIn: string): string | null {
  for (const build of producedIn.match(/Build_[A-Za-z0-9]+/g) ?? []) {
    if (MACHINES[build]) return MACHINES[build]
  }
  return null
}

function categoryFor(nativeClass: string, form: string): string {
  if (!SINKABLE_FORMS.has(form)) return form === 'RF_GAS' ? 'gas' : 'fluid'
  if (nativeClass.includes('FGResourceDescriptor')) return 'ore'
  if (nativeClass.includes('Biomass')) return 'biomass'
  if (nativeClass.includes('Ammo')) return 'ammo'
  if (nativeClass.includes('Consumable')) return 'consumable'
  if (nativeClass.includes('Equipment') || nativeClass.includes('Weapon')) return 'equipment'
  return 'part'
}

/** Assigns `slug(displayName)`, falling back to the class name on collision. */
function uniqueId(display: string, className: string, taken: Set<string>): string {
  let id = slug(display)
  if (taken.has(id)) id = slug(className.replace(/^(Desc|Recipe|BP)_/, '').replace(/_C$/, ''))
  let n = 2
  const base = id
  while (taken.has(id)) id = `${base}-${n++}`
  taken.add(id)
  return id
}

/* ------------------------------------------------------------------ *
 * Extraction
 * ------------------------------------------------------------------ */

function extract(groups: RawGroup[]) {
  // Pass 1: everything that looks like an item descriptor. Buildings share the
  // descriptor shape but have no mForm/mStackSize, which is what excludes them.
  const byClassName = new Map<string, OutItem & { referenced: boolean }>()
  const takenItemIds = new Set<string>()

  for (const group of groups) {
    if (/Buildable|BuildingDescriptor|VehiclePathSegment/.test(group.NativeClass)) continue
    for (const c of group.Classes) {
      if (!c.mDisplayName || !c.mForm || !c.mStackSize) continue
      if (byClassName.has(c.ClassName)) continue

      const points = Number(c.mResourceSinkPoints ?? 0)
      const sinkable = SINKABLE_FORMS.has(c.mForm) && Number.isFinite(points) && points > 0

      byClassName.set(c.ClassName, {
        id: '', // assigned below, once we know which items survive
        name: c.mDisplayName,
        className: c.ClassName,
        sinkPoints: sinkable ? points : null,
        form: c.mForm,
        category: categoryFor(group.NativeClass, c.mForm),
        ...(c.mCanBeDiscarded === 'False' ? { disposable: false } : {}),
        referenced: false,
      })
    }
  }

  // Pass 2: recipes that run in a production building.
  const recipeGroup = groups.find((g) => g.NativeClass.includes('FGRecipe'))
  if (!recipeGroup) throw new Error('no FGRecipe group in the docs file')

  const recipes: OutRecipe[] = []
  const takenRecipeIds = new Set<string>()
  const skipped: string[] = []

  for (const r of recipeGroup.Classes) {
    const machine = machineFor(r.mProducedIn ?? '')
    if (!machine) continue

    const resolve_ = (raw: string) =>
      parseIngredients(raw).map(({ className, amount }) => {
        const item = byClassName.get(className)
        if (!item) throw new Error(`recipe ${r.ClassName} references unknown item ${className}`)
        item.referenced = true
        // Fluids and gases are stored in cm3; the rest of the model works in m3.
        const quantity = SINKABLE_FORMS.has(item.form) ? amount : amount / 1000
        return { className, quantity }
      })

    let inputs, outputs
    try {
      inputs = resolve_(r.mIngredients ?? '')
      outputs = resolve_(r.mProduct ?? '')
    } catch (err) {
      skipped.push(`${r.ClassName}: ${(err as Error).message}`)
      continue
    }
    if (outputs.length === 0) {
      skipped.push(`${r.ClassName}: produces nothing`)
      continue
    }

    recipes.push({
      id: uniqueId(r.mDisplayName, r.ClassName, takenRecipeIds),
      name: r.mDisplayName,
      className: r.ClassName,
      machine,
      duration: Number(r.mManufactoringDuration ?? 0),
      ...(/^Recipe_Alternate_/.test(r.ClassName) ? { alternate: true as const } : {}),
      // placeholders; item ids are assigned in pass 3
      inputs: inputs as unknown as OutRecipe['inputs'],
      outputs: outputs as unknown as OutRecipe['outputs'],
    })
  }

  // Pass 3: keep an item only if it can be sunk or a surviving recipe touches
  // it. This drops vehicles, event props and other descriptors the optimizer
  // can never reach. Ids are assigned in a stable, name-sorted order.
  const kept = [...byClassName.values()]
    .filter((i) => i.sinkPoints !== null || i.referenced)
    .sort((a, b) => a.name.localeCompare(b.name) || a.className.localeCompare(b.className))

  const idByClassName = new Map<string, string>()
  for (const item of kept) {
    item.id = uniqueId(item.name, item.className, takenItemIds)
    idByClassName.set(item.className, item.id)
  }

  const toId = (side: { className: string; quantity: number }[]) =>
    side
      .map(({ className, quantity }) => ({ item: idByClassName.get(className)!, quantity }))
      .sort((a, b) => a.item.localeCompare(b.item))

  for (const r of recipes) {
    r.inputs = toId(r.inputs as unknown as { className: string; quantity: number }[])
    r.outputs = toId(r.outputs as unknown as { className: string; quantity: number }[])
  }
  recipes.sort((a, b) => a.id.localeCompare(b.id))

  const items: OutItem[] = kept.map(({ referenced: _referenced, ...rest }) => rest)
  return { items, recipes, skipped }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const inputPath = resolve(arg('input', 'resources/en-US.json'))
const checkOnly = process.argv.includes('--check')

const itemsPath = resolve('src/data/satisfactory/items.json')
const recipesPath = resolve('src/data/satisfactory/recipes.json')

/**
 * The docs export carries no version number of its own, so it has to be
 * supplied. Default to whatever the committed data already claims, which keeps
 * a plain re-run diff-free; pass --game-version after a game patch.
 */
function currentGameVersion(): string {
  try {
    return JSON.parse(readFileSync(itemsPath, 'utf8')).gameVersion ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
const explicitVersion = process.argv.some((a) => a.startsWith('--game-version='))
const gameVersion = arg('game-version', currentGameVersion())

let raw: Buffer
try {
  raw = readFileSync(inputPath)
} catch {
  // The docs export is the game's own file: 10 MB and gitignored, so it is
  // never present on a fresh clone or a CI runner. There is nothing to compare
  // against there, so --check skips instead of failing; the drift gate only
  // has teeth on a machine that has the game installed.
  if (checkOnly) {
    console.log(`skipped: no ${inputPath} to check against`)
    process.exit(0)
  }
  console.error(`Cannot read ${inputPath}

Copy the game's documentation export into resources/:
  <SteamLibrary>/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json
or pass --input=PATH.`)
  process.exit(1)
}

let groups: RawGroup[]
try {
  groups = JSON.parse(decode(raw)) as RawGroup[]
} catch (err) {
  console.error(`${inputPath} is not valid JSON (${(err as Error).message}).

This usually means the file was opened and re-saved in an editor, which breaks
its UTF-16 encoding. Copy a fresh one straight from the game folder.`)
  process.exit(1)
}
if (!Array.isArray(groups)) {
  console.error(`${inputPath} is JSON but not the game's docs export (expected an array of class groups).`)
  process.exit(1)
}

const { items, recipes, skipped } = extract(groups)

const itemsFile =
  JSON.stringify(
    {
      gameVersion,
      source: 'CommunityResources/Docs/en-US.json (shipped with the game)',
      generator: 'scripts/build-satisfactory-data.ts',
      note: ITEMS_NOTE,
      items,
    },
    null,
    2,
  ) + '\n'

const recipesFile =
  JSON.stringify(
    {
      gameVersion,
      source: 'CommunityResources/Docs/en-US.json (shipped with the game)',
      generator: 'scripts/build-satisfactory-data.ts',
      note: RECIPES_NOTE,
      recipes,
    },
    null,
    2,
  ) + '\n'

const sinkable = items.filter((i) => i.sinkPoints !== null).length
const alternates = recipes.filter((r) => r.alternate).length

if (checkOnly) {
  // Missing files count as stale rather than crashing, so --check works on a
  // fresh clone and in CI.
  const current = (path: string) => {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  }
  const stale = current(itemsPath) !== itemsFile || current(recipesPath) !== recipesFile
  console.log(stale ? 'STALE: regenerate with npm run data:satisfactory' : 'up to date')
  process.exit(stale ? 1 : 0)
}

writeFileSync(itemsPath, itemsFile)
writeFileSync(recipesPath, recipesFile)

console.log(`Satisfactory ${gameVersion} <- ${inputPath}`)
console.log(`  items   ${items.length} (${sinkable} sinkable)  -> ${itemsPath}`)
console.log(`  recipes ${recipes.length} (${alternates} alternate) -> ${recipesPath}`)
for (const s of skipped) console.warn(`  skipped ${s}`)
if (!explicitVersion) {
  console.log(`\nKept gameVersion "${gameVersion}". After a game patch, re-run with`)
  console.log(`  npm run data:satisfactory -- --game-version=X.Y`)
}
