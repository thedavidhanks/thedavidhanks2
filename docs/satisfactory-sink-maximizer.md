# Maximizing AWESOME Sink points

How to decide what to build out of a given set of source products so that the
AWESOME Sink pays you as much as possible.

- **Code:** [src/lib/satisfactory-sink/](../src/lib/satisfactory-sink/)
- **Data:** [src/data/satisfactory/](../src/data/satisfactory/) — 186 items and
  291 recipes, generated from the game's own export (§10)
- **Run it:** `npm run sink -- "Iron Ore"` · **Test it:** `npm run test:sink`
- **Refresh the data:** `npm run data:satisfactory`

---

## 1. The short version

The problem looks like a search over crafting trees. It is not. It is a
**linear program**, and once you write it down that way it is solved exactly,
in milliseconds, by a hundred lines of simplex.

The whole model is three lines:

- **Variables** — how many times to run each recipe, and how much of each item
  to feed the sink.
- **Constraints** — for every item: what you start with, plus what you make,
  minus what you consume, equals what you sink.
- **Objective** — maximize `Σ (units sunk × points per unit)`.

Everything else in this document is justification, edge cases, and how to run it.

## 2. Why the obvious algorithms give wrong answers

**"Follow the best chain."** Compute points-per-ore for every craftable item,
pick the winner, build only that. This is correct for exactly one case: a single
source product, no byproducts, no competition for intermediates. Change any of
those and it breaks.

Here is a counterexample, encoded as a test in
[maximize.test.ts](../src/lib/satisfactory-sink/maximize.test.ts):

| Recipe   | Inputs           | Output              | Points per source unit |
| -------- | ---------------- | ------------------- | ---------------------- |
| Widget X | 1 Coal + 1 Ore   | 1 Widget X (50 pts) | 50 / 2 = **25**        |
| Widget Y | 1 Coal + 5 Ore   | 1 Widget Y (200pts) | 200 / 6 = **33.3**     |

Widget Y has the better ratio, so greedy commits to it. Give it 10 Ore and
10 Coal and Y runs out of ore after 2 crafts: `400 pts + 8 leftover coal (24) = 424`.
The optimum ignores Y completely: 10 × Widget X = **500 pts**. The best ratio in
isolation is not the best ratio under a binding constraint, and which constraint
binds depends on the quantities you were handed.

**"Recurse over the crafting tree."** Fails because the tree is a *graph*.
Reinforced Iron Plate needs plates and screws; both trace back to iron ingots,
so the two branches compete for one pool. A tree recursion double-counts that
pool. It also cannot express the thing the brief specifically asks for —
combining *some* products and sinking the remainder raw — because "sink the
leftovers" is not a node in anyone's crafting tree.

**"Try every subset."** Exponential, and still wrong: the hard part is not
*which* products to combine but *in what proportions*, which is continuous.

A linear program handles all of it natively, because "how much of each item goes
where" is exactly what LP variables are for.

## 3. The model

### Notation

| Symbol      | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `i ∈ I`     | items                                                        |
| `r ∈ R`     | recipes                                                      |
| `a[r,i]`    | units of item `i` consumed by one craft of `r`               |
| `b[r,i]`    | units of item `i` produced by one craft of `r`               |
| `p[i]`      | sink points for one unit of `i` (`null` ⇒ cannot be sunk)    |
| `g[i]`      | units of `i` you were given (0 for anything not a source)    |
| `w[i]`      | relative cost of one unit of source `i` (default 1)          |

### Variables

| Variable | Range | Meaning                                                  |
| -------- | ----- | -------------------------------------------------------- |
| `x[r]`   | `≥ 0` | crafts of recipe `r`                                      |
| `s[i]`   | `≥ 0` | units of `i` fed to the sink (only where `p[i]` exists)   |
| `d[i]`   | `≥ 0` | units of `i` thrown away (only for unsinkable items)      |

### Constraints — one per item

```
g[i]  +  Σ_r b[r,i]·x[r]   =   Σ_r a[r,i]·x[r]  +  s[i]  +  d[i]
────    ─────────────────       ─────────────────    ────    ────
given   produced                consumed             sunk    dumped
```

Nothing appears from nowhere and nothing vanishes. That single equation per item
is the entire physics of the problem.

### Objective

```
maximize   Σ_i p[i] · s[i]
```

That's it. It is linear in every variable, so the feasible region is a convex
polytope and the optimum sits on a vertex — which is precisely what simplex
finds, exactly, with no search heuristics and no local maxima to get stuck in.

### Why fractional crafts are the right model

`x[r]` is a real number, not an integer. That is not a relaxation you have to
apologize for — it is what Satisfactory actually does. A factory is a
steady-state flow, `x[r]` is a production **rate**, and 2.5 crafts/min is just
three machines at 83% clock. Requiring integers would turn a polynomial problem
into an NP-hard integer program for no gain. (See
[Limitations](#9-known-limitations) for when this matters.)

## 4. Two different questions

"Maximize points per source product" means two different things depending on
whether your supply is fixed, so the solver answers both.

### `fixed` — "I have these amounts"

You supply quantities (or, better, rates in items/min from your miners). `g[i]`
is a constant. The solver maximizes **total points** and reports
`totalPoints / Σ w[i]·g[i]` as the per-unit figure.

This is the mode that produces the behaviour the brief describes: because
sinking a raw product is always an available move, the LP naturally combines
products up to the point where the scarcer one runs out and then sinks the
surplus untouched. No special-casing required — it falls out of the model.

### `ratio` — "I have as much as I want, in any mix"

Supply becomes a variable `u[i] ≥ 0` and we add one normalizing row:

```
Σ_{i ∈ sources} w[i]·u[i] = 1
```

Maximizing points subject to "one unit of source" *is* maximizing the
points-per-source ratio. This is the Charnes–Cooper transform: a linear
fractional objective `(Σ p·s) / (Σ w·u)` becomes a plain linear objective once
you fix the denominator to 1, which is legal here because the whole system is
scale-invariant. The optimal `u` is then the **best mix** to feed in — and the
solver will happily set `u[i] = 0` for a product that does not earn its place.
Those products are reported in `plan.declined`, by name, rather than quietly
missing from the output.

`w[i]` lets you say a unit of one product costs more than a unit of another
(by rarity, node count, or logistics pain). Default is 1 across the board.

### Which one you get by default

**`ratio` is the default for exactly one shape of input: a single product with
no quantity.** Everything else defaults to `fixed`, and a product named without
a quantity counts as 1.

The rule reads oddly until you notice what a bare list of products means. A
single product has no mix to choose, so `ratio` and "one unit of it" ask the
same question and `ratio` is the more useful phrasing — it is a rate, and
`--scale` can size it. Name *several* products with no quantities, though, and
you mean "here is what I have, plan for all of it". A ratio answers something
else entirely: the one-unit budget is a **budget**, so it goes to whichever
product scores highest and the rest are set to zero. Ask for `"motor" "coal"`
and you would be told to sink the motor and never hear about the coal again.

The same rule fixes a quieter footgun. `"Iron Ore:600" "Coal"` used to be a
ratio too — every source needed a quantity to earn `fixed` mode — which meant
the `600` was accepted, ignored, and never mentioned. It is now `fixed` with
one coal.

Ratio over several products is still a real question, and `--mode=ratio` still
asks it: *if I could feed anything, in any proportion, what should I build?*
It is the right question when you are choosing what to mine, and the wrong one
when you are standing on a pile of things you already have.

## 5. The algorithm, end to end

```
maximizeSinkPoints(dataset, sources, mode)
 │
 ├─ 1. Validate            reject unknown items, non-positive quantities,
 │                         duplicate ids, output-less recipes
 │
 ├─ 2. Forward closure     start from the source items; repeatedly enable a
 │      (O(V + E))         recipe once ALL its inputs are obtainable, and add
 │                         its outputs to the obtainable set.
 │                         Everything unreachable is discarded here — this is
 │                         what keeps the tableau small when the dataset holds
 │                         the full recipe book.
 │
 ├─ 3. Build the tableau   one row per reachable item (+1 for the ratio-mode
 │                         budget row); columns for recipes, sinks, dumps and
 │                         (in ratio mode) supplies
 │
 ├─ 4. Two-phase simplex   phase 1 finds a feasible vertex via artificial
 │                         variables; phase 2 climbs to the optimum.
 │                         Dantzig's rule for speed, falling back to Bland's
 │                         rule if it runs long, which guarantees termination
 │                         on the degenerate vertices production graphs are
 │                         full of.
 │
 ├─ 5. Read back the plan  recipe run counts, what to sink, what to dump,
 │                        the source mix, and points per source unit
 │
 └─ 6. Decompose the flow  split each item's production across its consumers in
       (O(items x P x C)) proportion, giving a graph you can draw: source ->
                          recipes -> Sink. See §11 for the one caveat.
```

Step 2 is a worklist over a bipartite item/recipe graph with a
missing-input counter per recipe, so each recipe is enabled at most once.

The solver reports three outcomes:

- `optimal` — a plan.
- `infeasible` — the source itself can neither be sunk nor discarded nor
  consumed by any reachable recipe, so there is no legal plan at all. On the
  shipped dataset this happens for exactly **9 of 186 items**, all of them
  solids the game marks non-discardable: the three Power Slugs, Power Shard,
  Uranium Waste, Plutonium Waste, Plutonium Pellet, Encased Plutonium Cell and
  Non-Fissile Uranium. That is a correct answer, not a failure — you genuinely
  cannot get rid of a Power Shard.
- `unbounded` — the recipe set contains a loop that nets out sinkable items from
  nothing, so "maximum points" is infinite. No item in the shipped dataset does
  this (there is a test over all 186), but see §9 for the one recipe that
  produces from nothing and why it stays safe.

## 6. Worked examples

All numbers below come from the shipped dataset, which is generated from the
game's own documentation export (see §10) and holds **186 items and 291
recipes**. 110 of those recipes are alternates that need Hard Drive unlocks;
`--no-alternates` restricts the solver to the recipes every save has, and
`--alternates=` / `--alternates-file=` restrict it to the ones *your* save has
(§7).

### One product: Iron Ore

```
$ npm run sink -- --scale=48 --no-alternates "Iron Ore"

Total sink points : 1073.5484
Points per source : 22.3656

Source products consumed:
          48 x Iron Ore  (100.0% of budget)

Recipes to run (crafts):
          48 x Iron Ingot
     29.4194 x Iron Rod
     19.0968 x Screws
      6.1935 x Iron Plate
      2.0645 x Rotor
      2.0645 x Reinforced Iron Plate
      2.0645 x Smart Plating

Feed to the AWESOME Sink:
      2.0645 x Smart Plating  @ 520 = 1073.5484 pts

Material flow (source -> sink):
  Iron Ore                       48 x Iron Ore               -> Iron Ingot
  Iron Ingot                29.4194 x Iron Ingot             -> Iron Rod
  Iron Ingot                18.5806 x Iron Ingot             -> Iron Plate
  Iron Rod                  19.0968 x Iron Rod               -> Screws
  Iron Plate                12.3871 x Iron Plate             -> Reinforced Iron Plate
  Iron Rod                  10.3226 x Iron Rod               -> Rotor
  Screws                    51.6129 x Screws                 -> Rotor
  Screws                    24.7742 x Screws                 -> Reinforced Iron Plate
  Reinforced Iron Plate      2.0645 x Reinforced Iron Plate  -> Smart Plating
  Rotor                      2.0645 x Rotor                  -> Smart Plating
  Smart Plating              2.0645 x Smart Plating          -> AWESOME Sink
```

The last block is the plan as a graph — the same numbers as the recipe list, but
with the edges filled in, so you can draw it. §11 covers the machine-readable
form (`plan.flow`) and the one caveat that comes with it.

Compare against the hand-worked chains in the brief: raw ore 1, ingots 2, plates
4, rods 4, screws 8, Reinforced Iron Plate 10 — against the solver's **22.37
points per ore**, found by carrying the chain up to Smart Plating
(1 Reinforced Iron Plate + 1 Rotor). It splits the rods without being told to:
some become screws, the rest go into rotors, in whatever proportion makes both
sub-chains finish together.

Unlock the alternate recipes and the same ore is worth **37.24 points**, via
Alternate: Iron Wire (1 ingot → 9 wire, against 1 → 2 standard) into Automated
Wiring at 1440 points. Which number is "right" depends on your save — that is
exactly why the flag exists.

> One discrepancy worth flagging: the brief's option E uses `6 Iron Rod +
> 12 Screws → 1 Reinforced Iron Plate` and gets 13.3 points/ore. The game's
> recipe is `6 Iron Plate + 12 Screws`, which costs 12 ore rather than 9 and so
> yields 10 points/ore. The shipped dataset uses the game's version; the brief's
> version is kept as a test fixture, and the solver returns exactly 13.3̅ for it.

### Sink some products untouched

```
$ npm run sink -- --no-alternates "Coal:600" "Sulfur:100"

Total sink points : 15500
Points per source : 22.1429

Recipes to run (crafts):
          30 x Diamonds
          15 x Time Crystal

Feed to the AWESOME Sink:
          15 x Time Crystal  @ 960 = 14400 pts
         100 x Sulfur  @ 11 = 1100 pts

Material flow (source -> sink):
  Coal                 600 x Coal          -> Diamonds
  Sulfur               100 x Sulfur        -> AWESOME Sink
  Diamonds              30 x Diamonds      -> Time Crystal
  Time Crystal          15 x Time Crystal  -> AWESOME Sink
```

The flow table makes the shape of this answer obvious: two chains that never
meet, one of them a single hop straight to the Sink.

This is the brief's "sink the rest without modification" case, and the solver
reaches it by arithmetic rather than by a special rule. Black Powder
(1 Coal + 1 Sulfur → 2, worth 28) looks like the obvious way to spend sulfur.
But 40 coal becomes 2 Diamonds becomes 1 Time Crystal at 960 points, so coal is
worth 24/unit — which makes a sulfur spent on Black Powder worth only
`28 − 24 = 4`, against **11 for dropping it in the Sink untouched**. So all 600
coal goes to Time Crystals and every sulfur is sunk raw.

Allow alternates and the balance tips back: Alternate: Compacted Coal
(5 Coal + 5 Sulfur → 5) feeds Alternate: Fine Black Powder, and the total rises
to 15600 for the same inputs.

### Combining is not automatically better

```
$ npm run sink -- --no-alternates "Iron Ore:600" "Coal:300"

Total sink points : 20619.3548
Points per source : 22.9104

Feed to the AWESOME Sink:
     25.8065 x Smart Plating  @ 520 = 13419.3548 pts
         7.5 x Time Crystal  @ 960 = 7200 pts
```

Steel Ingot (3 Iron Ore + 3 Coal → 3) is the obvious way to combine these two.
The solver refuses it: not one craft of steel appears. The iron goes to Smart
Plating and the coal goes to Time Crystals, on two chains that never touch. The
result is exactly the weighted average of solving each product alone —
`(600 × 22.3656 + 300 × 24) / 900 = 22.9104` — because coal is worth more as
Time Crystals and iron more as Smart Plating than either is as steel.

Now unlock alternates:

```
$ npm run sink -- "Iron Ore:600" "Coal:300"

Total sink points : 48287.5306
Points per source : 53.6528

Recipes to run (crafts):
    737.1638 x Screws
         600 x Iron Ingot
    300.3667 x Alternate: Steel Rod
         150 x Alternate: Solid Steel Ingot
    ...
```

The same two products are now emphatically worth combining, through
Alternate: Solid Steel Ingot (2 Coal + 2 Iron Ingot → 3 Steel Ingot), which
converts iron to steel at a far better rate than the standard recipe. **Whether
to combine is a property of the recipe set, not of the products** — which is
precisely why it should be solved rather than reasoned about by hand.

### A product that does not earn its place

```
$ npm run sink -- --mode=ratio "Mycelia" "Leaves"

Points per source : 288

Source products consumed:
           1 x Mycelia  (100.0% of budget)

Not worth feeding (they lower points per source unit):
          Leaves
  Give quantities (e.g. "coal:300") to plan for them anyway.
```

Both products feed Biomass, so combining them looks natural. But 1 Mycelia
makes 10 Biomass while 10 Leaves make only 5. Since the denominator counts every
source unit equally, any leaf in the mix drags the average down. The solver sets
`u[leaves] = 0` and says so — the "you don't have to use all the products
provided" case, decided rather than guessed.

Note the `--mode=ratio`. It is doing real work here: without it this is a
two-product invocation and you get `fixed` mode, which uses the leaves (§4).
Note also that the declined product is *named*. A zero-quantity source used to
be filtered out of the plan, so the only evidence that you had asked about
leaves at all was their absence.

### Products that never touch

```
$ npm run sink -- "motor" "coal"

Total sink points : 1544
Points per source : 772

Source products consumed:
           1 x Motor  (50.0% of budget)
           1 x Coal  (50.0% of budget)

Recipes to run (crafts):
        0.05 x Diamonds
       0.025 x Time Crystal

Feed to the AWESOME Sink:
           1 x Motor  @ 1520 = 1520 pts
       0.025 x Time Crystal  @ 960 = 24 pts
```

A Motor is worth more raw (1520) than anything you can build out of one, and
coal cannot be built into a motor, so the two chains never meet. There is
nothing to decide — just do both. This is what makes it the sharpest case for
§4's default: as a *ratio* the question is degenerate, because a one-unit
budget split between two independent products is maximized by spending all of
it on the better one. `--mode=ratio "motor" "coal"` still reports exactly that,
declining the coal, and it is still the correct answer to that question.

The coal is worth **24, not 2**. Sinking it raw pays 2, but 40 coal makes 2
Diamonds makes 1 Time Crystal at 960, and `0.025` of a Time Crystal is a legal
answer here — it is a machine at 2.5% clock, not a rounding error (§9).

## 7. Running it

Requires Node 22+ (24 in the dev container). Node strips the TypeScript types
natively — there is **no build step and no new dependency**.

```bash
# One product, unlimited supply — best points per unit
npm run sink -- "Iron Ore"

# Scale the plan to a readable size
npm run sink -- --scale=48 "Iron Ore"

# Fixed amounts (or rates in items/min) — maximize the total
npm run sink -- "Iron Ore:600" "Coal:300"

# Several products, no quantities — one of each, and all of them get used
npm run sink -- "Motor" "Coal"

# Say that sulfur costs 5x what coal costs
npm run sink -- --mode=ratio "Coal" "Sulfur@5"

# Only recipes available without Hard Drive unlocks
npm run sink -- --no-alternates "Iron Ore"

# Only the alternates this save has unlocked
npm run sink -- --alternates="Iron Wire,Solid Steel Ingot" "Iron Ore:600" "Coal:300"
npm run sink -- --alternates-file=my-save.txt "Iron Ore:600" "Coal:300"

# Machine-readable, and what's in the dataset
npm run sink -- --json "Iron Ore"
npm run sink -- --list
npm run sink -- --list-alternates

npm run test:sink
```

Product syntax is `"Name[:quantity][@weight]"`. Names are matched loosely, so
`"iron ore"`, `"Iron Ore"` and `iron-ore` all work. A **single** product with no
quantity gets `ratio` mode; anything else gets `fixed` mode, counting a missing
quantity as 1 (§4). `--mode=` overrides both, and `--scale` is a ratio-mode flag
— pass it in fixed mode and the CLI says it is ignoring it rather than pretending
to apply it.

### Choosing which alternates the solver may use

The default is "every alternate is unlocked", which is true of no real save.
`--alternates` narrows it to the list you give: **only those alternates are
available to the algorithm**, every other one is dropped before the LP is built,
and standard recipes are always available regardless.

- Names are matched the same loose way products are, and the `Alternate:`
  prefix is optional — `"Iron Wire"`, `"Alternate: Iron Wire"` and
  `alternate-iron-wire` are the same recipe. `--list-alternates` prints all 110.
- The flag is repeatable and comma-separated; `--alternates-file=F` reads the
  same names from a file, one per line, with `#` comments and blank lines
  ignored. A save's unlock list is long enough that the file is the ergonomic
  form — keep one per save and pass it every time.
- Naming a recipe that is not an alternate is an error, as is naming one that
  does not exist, and `--alternates` with `--no-alternates` is rejected rather
  than silently resolved. `--alternates=` with an empty list is the same as
  `--no-alternates`.

The three settings bracket the answer. For `"Iron Ore:600" "Coal:300"`:

| Alternates available          | Points per source unit |
| ----------------------------- | ---------------------- |
| `--no-alternates`             | 22.91                  |
| `--alternates="Solid Steel Ingot"` | 26.36             |
| `--alternates="Iron Wire,Solid Steel Ingot,Cast Screws"` | 38.74 |
| all 110 (default)             | 53.65                  |

### Refreshing the dataset after a game patch

```bash
# Copy the game's own docs export into resources/, then:
npm run data:satisfactory

# Fails if the checked-in JSON no longer matches the export (CI-friendly)
npm run data:satisfactory:check

# After a game patch, stamp the new version (defaults to the committed one)
npm run data:satisfactory -- --game-version=1.2
```

§10 covers what the generator does and why. The
[README](../README.md#updating-the-item-and-recipe-data-after-a-game-patch) has
the same procedure written for someone who has never touched this repo,
including where the game file lives on each platform.

### From code

```ts
import { maximizeSinkPoints, formatPlan } from './src/lib/satisfactory-sink/maximize.ts'
import { satisfactoryDataset } from './src/lib/satisfactory-sink/dataset.ts'

const plan = maximizeSinkPoints({
  dataset: satisfactoryDataset,
  sources: [{ item: 'iron-ore', quantity: 600 }, { item: 'coal', quantity: 300 }],
})

console.log(plan.totalPoints)          // 48287.53...
console.log(plan.pointsPerSourceUnit)  // 53.65...
console.log(plan.flow.nodes.length)    // 13 nodes, source -> recipes -> Sink
console.log(formatPlan(plan))
```

`maximizeSinkPoints` takes any `Dataset` object, so you can pass made-up recipes
straight in without touching the JSON — that is how most of the tests work.
Full shapes are in [types.ts](../src/lib/satisfactory-sink/types.ts).

## 8. Time complexity

Let `V` = items, `R` = recipes, `E = Σ(|inputs| + |outputs|)` over all recipes.
After the closure step, `m` = reachable items (LP rows) and
`n = R' + |sinkable| + |dumpable| + |sources|` (LP columns).

| Stage                | Cost                     |
| -------------------- | ------------------------ |
| Validation           | `O(V + E)`               |
| Forward closure      | `O(V + E)`               |
| Tableau construction | `O(m · (n + m))`         |
| One simplex pivot    | `O(m · (n + m))`         |
| Plan extraction      | `O(m + n)`               |

Total: **`O(V + E + P · m · (n + m))`**, where `P` is the pivot count.

- **In practice**, `P` grows roughly linearly in the problem size (`P ≈ 2–3(m + n)`
  is the standard empirical rule), giving **`O(m · (m + n)²)`**. That bound is
  measured, not assumed: on the full shipped dataset (186 items, 291 recipes, so
  `m ≤ 186`, `n ≤ 640`) solving *every* item as a single-product ratio problem —
  186 separate LPs — takes **30 ms total, worst single solve 1.3 ms**. The whole
  30-test suite runs in ~165 ms.
- **Worst case**, simplex is exponential: `O(2^m)` pivots on adversarial inputs
  such as the Klee–Minty cube. This is a theoretical wart, not a practical one —
  those inputs do not resemble recipe graphs — and the fallback to Bland's rule
  guarantees the solver terminates rather than cycling forever.
- **Guaranteed polynomial** alternatives exist if you ever need the bound:
  linear programming is in **P** via interior-point methods (`O(n^3.5 L)`,
  Karmarkar), which you would reach for only at a scale this problem never hits.
- **Memory** is `O(m · (n + m))` for the dense tableau — a few hundred KB.

The closure step matters more than any of this: given only Limestone, it prunes
291 recipes down to 2 before the LP ever starts.

**The integer variant is NP-hard.** If you insist on whole crafts (you have
exactly 37 iron ore in your inventory, not a 37/min belt), this becomes an
integer program, which subsumes knapsack. For belt-rate planning — the actual
use case — the continuous answer is the correct one.

## 9. Known limitations

- **Rates, not inventories.** Fractional crafts are right for a factory and
  wrong for a backpack. Rounding down is near-optimal at large quantities and
  can be off by a bit at small ones.
- **No machine, power, or belt-throughput costs.** The model optimizes points
  per *source unit*, not per MW or per building. Two plans with equal points can
  differ wildly in how much factory they need.
- **Byproducts are dumped for free** unless an item is `disposable: false`,
  which the generator sets from the game's own `mCanBeDiscarded` flag. In-game
  an unconsumed byproduct backs up a belt or pipe and stalls the line, so this
  is optimistic for anything the game *lets* you discard but that you have no
  practical way to vent — most notably water.
- **No sink-point decay.** Some Satisfactory items' point values shift with
  progression; the model treats `p[i]` as constant.
- **Alternate recipes are assumed unlocked** unless you say otherwise. 110 of
  the 291 shipped recipes need Hard Drives, and they change the answer a lot
  (Iron Ore: 22.37 → 37.24 points). `--no-alternates` drops all of them and
  `--alternates`/`--alternates-file` keep only the ones you name (§7), but the
  list is yours to maintain — nothing reads your save file.
- **One recipe produces from nothing.** Excited Photonic Matter comes out of a
  Converter using only power, so the model treats it as a free input. It cannot
  be sunk, so it creates no free points — but a future recipe that turns it into
  something sinkable would make the LP genuinely unbounded, which is why
  there is a test asserting no item yields unbounded points.
- **Data accuracy is on the dataset, not the algorithm** — see below.

## 10. How the source data is stored

### Decision: flat JSON files, not a database

The question is whether the data is big enough to need a database. It is not,
and it is not close. Here is the whole dataset, generated from the game's own
export:

| File           | Rows | Raw    | Gzipped   |
| -------------- | ---- | ------ | --------- |
| `items.json`   | 186  | 37 KB  | 4.9 KB    |
| `recipes.json` | 291  | 146 KB | 12.0 KB   |
| **Total**      | 477  | 183 KB | **17 KB** |

Measured on this dataset:

- **Parse + full validation: 0.61 ms** (mean of 50 runs).
- **Transfer: 17 KB gzipped.** Even on a throttled 400 kbps connection that is
  ~0.35 s, and on anything resembling broadband it is a single packet burst
  well under the 1 s bar. In the Vite build it is inlined into the bundle, so
  the marginal request count is zero.
- **Loading costs about the same as one solve.** A typical ratio solve
  (`iron-ore`) is 0.27 ms and the worst observed is 1.3 ms, against 0.58 ms to
  parse and validate the whole dataset — *once* per process, after which every
  solve is pure CPU on in-memory arrays.

A database would add a network round trip (typically 20–100 ms to Firestore,
i.e. **30–150× the cost of parsing the entire dataset from disk**), a client
SDK, credentials, and an offline failure mode — in exchange for query
capabilities this workload never uses. The solver does not query. It loads
every item and every recipe into memory on the first call, because the LP needs
the whole graph to compute a closure over it. That is the exact access pattern
files are best at and databases are worst at.

**When to revisit.** The bound that matters is memory and parse time, not row
count. Reconsider if any of these become true:

- The dataset passes ~5 MB raw (roughly 30× current), where parse time starts
  to be perceptible on a cold page load.
- You need per-user *writes* — saved factory plans, or a player's unlocked
  alternate-recipe list. That is user data, not source data, and it belongs in
  Firestore (already configured in this project) *alongside* the static JSON,
  not replacing it.
- You need to serve many game versions at once and want to avoid shipping all
  of them to every client.

None of those apply today. Storing 183 KB of static, read-only,
regenerated-on-patch reference data in a database would be strictly worse on
latency, complexity, and offline behaviour.

### Shape: two JSON files, generated not hand-written

```
src/data/satisfactory/
  items.json      # id, name, className, sinkPoints, form, category, disposable?
  recipes.json    # id, name, className, machine, duration, alternate?, inputs[], outputs[]
```

1. **Sink points live on the item, not in a separate points table.** They are an
   intrinsic property of an item; a third file is a third thing to keep in sync.
   `sinkPoints: null` is the explicit encoding for "cannot be sunk" (fluids,
   and any other excluded category) — distinct from `0`, and it makes the solver
   treat the item as a byproduct to be routed rather than a dead end.
2. **Items and recipes stay in separate files** because they change at different
   rates. Alternate recipes churn every patch; the item list barely moves.
3. **Kebab-case ids are the join key**, derived from the display name
   (`iron-ore`, `alternate-wet-concrete`). Every row also carries the Unreal
   `className` (`Desc_OreIron_C`), which is the truly rename-proof key — see the
   trade-off below.
4. **Every file carries `gameVersion`, `source` and `generator`** so a stale
   number is traceable to where it came from and to what produced it.

### Generated from the game, not transcribed from the wiki

Satisfactory ships a machine-readable dump of every item, recipe and building
with the game itself:

```
<SteamLibrary>/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json
```

That is the authoritative source — the wiki's own sink-points table is generated
from it — so transcribing the wiki by hand is copying a copy. The importer is
[`scripts/build-satisfactory-data.ts`](../scripts/build-satisfactory-data.ts):

```bash
# drop the game's en-US.json into resources/, then
npm run data:satisfactory
#   items   186 (154 sinkable)  -> src/data/satisfactory/items.json
#   recipes 291 (110 alternate) -> src/data/satisfactory/recipes.json
```

Five things it has to deal with, all of which are non-obvious:

- **The encoding is UTF-16LE with a BOM**, not UTF-8. The script decodes by
  sniffing the BOM so a re-encoded copy still works.
- **Every value is a string**, including numbers and booleans, and the
  ingredient lists are Unreal property dumps that need parsing:
  `((ItemClass="...Desc_IronPlate_C'",Amount=6),...)`.
- **Fluid and gas amounts are in cm³**, so a recipe's `Amount=5000` of water is
  5 m³. Solids are plain counts. Getting this wrong inflates fluid costs 1000×,
  so there is a regression test pinning Alternate: Wet Concrete at 5 water.
- **`mResourceSinkPoints = 0` means "cannot be sunk"**, and becomes `null` in
  our JSON rather than `0`. Separately, *every fluid and gas is forced to
  `null`* regardless of its listed points — the Sink has a conveyor input and no
  pipe input, so Water's nominal 5 points are unreachable.
- **872 of the entries are recipes, but 581 are buildings.** Only recipes that
  run in one of the 11 production machines are kept; build-gun and
  hand-craft-only recipes are dropped.

Output is deterministic — sorted arrays, stable ids, no timestamp — so a game
patch produces a reviewable diff instead of a rewrite. `npm run
data:satisfactory:check` regenerates in memory and exits non-zero if the
checked-in files have drifted, which is the CI hook.

**The raw export is not committed.** It is ~11 MB and it is Coffee Stain's
content, shipped with no explicit license; only the 183 KB derived subset is in
git. `resources/en-US.json` is already in `.gitignore`.

**`gameVersion` is not detected** — the export carries no version number. The
script reuses whatever the committed `items.json` already claims, so an ordinary
re-run stays diff-free, and prints a reminder to pass
`--game-version=X.Y` after a game patch. Getting this wrong mislabels the data
but does not corrupt it.

**Id trade-off, made deliberately.** Ids are `slug(displayName)`, not
`slug(className)`. Class names are more stable across patches, so this is the
less conservative choice; it was made because readable ids (`iron-ore`, not
`ore-iron`) keep the CLI, the docs and the JSON diffs legible, and because a
renamed item *should* surface as a visible diff rather than be silently
absorbed. `className` is on every row, so switching `uniqueId()` to key off it
is a one-line change if a future patch makes renames painful.

### Validate at the boundary

[`loadDataset()`](../src/lib/satisfactory-sink/dataset.ts) type-checks the JSON
and rejects unknown item references, non-positive quantities, duplicate ids and
output-less recipes at import time. Generated data deserves a loud failure on
malformed input rather than a silently wrong plan.

### If this becomes a page on the site

The solver takes a `Dataset` argument and never reaches for a global, so a UI
can:

- ship the JSON as the default (Vite inlines all 17 KB gzipped into the bundle),
  and
- overlay per-user data from Firestore — a single document holding the set of
  recipe ids that player has unlocked.

That is the main feature this design is set up for: *your* optimal plan depends
on *your* unlocked alternates, and it is worth 22.37 vs 37.24 points per iron
ore. Filtering is a one-line change with this layout — the CLI's
`--alternates` already does exactly this, with the unlock list coming from a
flag or a file instead of Firestore:

```ts
const dataset = { ...satisfactoryDataset, recipes: satisfactoryDataset.recipes.filter(r => unlocked.has(r.id)) }
```

Note the split this implies: **static source data stays in JSON, per-user state
goes in Firestore.** They have different owners, different update cadences, and
different failure modes; conflating them is what would push the reference data
into a database for no benefit.

### Versioning

If more than one game version ever needs supporting, nest by version
(`src/data/satisfactory/1.1/items.json`) rather than adding a version field to
every row. Datasets are loaded whole; per-row versioning would only ever be dead
weight.

## 11. Notes for building a UI on top of this

Everything below is a property of the code as it stands, collected here so the
next person does not have to rediscover it.

### The entire API surface

```ts
import { maximizeSinkPoints, formatPlan } from './src/lib/satisfactory-sink/maximize.ts'
import { satisfactoryDataset, findItem, findRecipe } from './src/lib/satisfactory-sink/dataset.ts'

const plan: Plan = maximizeSinkPoints({ dataset, sources, mode?, scaleTo? })
```

One pure function, no global state, no I/O, no async. Full shapes are in
[types.ts](../src/lib/satisfactory-sink/types.ts); `npm run sink -- --json`
prints exactly the `Plan` object, so the CLI doubles as a fixture generator for
UI tests. `plan.flow` is the graph described below.

### `plan.flow` — the plan as a drawable graph

`recipes`, `sinks` and `sources` are three flat lists with no edges between
them. `plan.flow` is the same plan with the edges filled in: a path from every
source product to the AWESOME Sink, through every recipe the plan runs.

The tool page draws it. [layout.ts](../src/lib/satisfactory-sink/layout.ts) turns
a `FlowGraph` into boxes and bezier paths — pure geometry, no React, no DOM, so
it is tested like the rest of the library
([layout.test.ts](../src/lib/satisfactory-sink/layout.test.ts)) — and
[FlowDiagram.jsx](../src/components/tools/satisfactorysink/FlowDiagram.jsx)
paints the result as hand-rolled SVG, top to bottom, sources on the first row
and the Sink on the last. One box per *item*, not per recipe: a recipe node is
labelled with its primary output and carries the recipe name underneath only
when that adds something. The four caveats below are all load-bearing there —
pooled edges are dashed and counted in the legend, off-sink-path nodes are faded
rather than dropped, the cyclic case draws its back-edge pointing back up the
diagram instead of assuming a DAG, and an empty graph renders nothing at all.

The edge quantities are the one thing on that page the tables do not carry —
`recipes` reports craft counts, not belt rates — so the diagram also emits every
edge as a visually-hidden list. Keep that in step with the drawing: without it
the SVG is the sole carrier of those numbers, which is a WCAG 1.1.1 failure and,
more to the point, unreadable to anyone who is not looking at the picture.

```ts
plan.flow.nodes  // { id, kind, name, item?, recipe?, quantity?, runs?, machine?, depth, onSinkPath }
plan.flow.edges  // { from, to, item, itemName, quantity, pooled }
```

`kind` is `source | recipe | sink | waste`. Node ids are `source:<itemId>`,
`recipe:<recipeId>`, `sink` and `waste`; edge `from`/`to` are those ids. There
is exactly one `sink` node — it is one building, and the edges carry the item —
and a `waste` node only when the plan has to vent something. Built by
[flow.ts](../src/lib/satisfactory-sink/flow.ts) from the finished `Plan`, so its
numbers are the same scaled, rounded ones every other field shows.

Four things to know before rendering it:

1. **`pooled: true` means the split is a choice, not a fact.** The LP fixes how
   many times to run each recipe, but never which producer's output feeds which
   consumer — that does not change the objective. When an item has more than one
   producer *and* more than one consumer, the edges are a proportional split of
   a shared pool: correct in aggregate, arbitrary pair by pair. Only the pooled
   totals are determinate, so render those edges as a pool (or at least
   differently) rather than as observed routing. Single-product plans never
   trigger it; a 12-ore plan has 54 pooled edges out of 181.
2. **The graph can contain cycles.** Alternate: Recycled Plastic and Alternate:
   Recycled Rubber consume each other's output, and a plan using both produces a
   genuine loop. Do not reach for a DAG layout that assumes otherwise. `depth`
   is a longest-path rank from the sources, capped so a cycle cannot spin — a
   layout *hint*, not a guarantee of edge direction between layers.
3. **`onSinkPath: false` marks a dead end.** Every recipe node on the shipped
   dataset is on a source→sink path (there is a test over all 186 items), but it
   is not a theorem: a recipe run purely to get rid of a non-discardable
   byproduct terminates at `waste`. Such nodes stay in the graph — they are part
   of the plan — and carry the flag so you can grey them out. A `source` node
   gets `false` when the whole plan for it is "vent it", which is the honest
   answer for the 15 fluids that score nothing.
4. **It is empty for a non-optimal plan**, matching `recipes` and `sinks`.
   `flow` is always present, never `undefined`, so there is nothing to
   null-check — but `{ nodes: [], edges: [] }` still means "render the reason,
   not a diagram" (see point 2 below).

### Six things that will bite a UI

1. **Render `plan.declined`, or products will vanish.** In `ratio` mode the
   solver may spend none of the budget on a product, which is a real answer
   (§6) — but a picker that shows only `plan.sources` renders it as the product
   silently disappearing from a plan the user asked for. `declined` carries
   `{ item, name }` for each one; `formatPlan` prints them under "Not worth
   feeding". It is always empty in `fixed` mode, so there is exactly one place
   this can happen.
2. **Handle all three statuses.** `optimal | infeasible | unbounded`. Non-optimal
   plans carry a human-readable `reason` and have empty `recipes`/`sinks` arrays
   — render the reason, do not render an empty plan as "0 points". Infeasible is
   reachable from ordinary user input: picking Power Shard as your only source
   produces it (see §5).
3. **`loadDataset()` drops fields the JSON has.** Items keep
   `id, name, sinkPoints, disposable, category` but lose `className` and `form`;
   recipes keep `id, name, inputs, outputs, alternate, machine` but lose
   `className` and `duration`. A UI wanting item icons (keyed by `className`) or
   throughput (points per *minute*, which needs `duration`) must widen `Item`
   and `Recipe` in [types.ts](../src/lib/satisfactory-sink/types.ts) and pass
   them through [dataset.ts](../src/lib/satisfactory-sink/dataset.ts). The data
   is already in the JSON; only the loader is narrow.
4. **Optima are unique in value, not in plan.** `totalPoints` is determinate,
   but when two routes tie exactly the LP may return either. Do not write UI
   tests that assert on a specific recipe list; assert on `totalPoints`.
5. **Everything is a rate, and fractional.** `2.0645 x Smart Plating` means
   machines at partial clock, not "round to 2". Present per-minute figures or
   machine counts, and never silently round — §9 covers why.
6. **It is fast enough to run on every keystroke.** A solve is 0.27 ms typical,
   1.3 ms worst observed. No debounce, no web worker, no loading state needed.

### The obvious first feature

Per-user unlocked alternates. The data already carries `alternate: true` on 110
of 291 recipes, the solver already takes any `Dataset`, and the difference is
large enough to be the point of the app (22.37 vs 37.24 points per iron ore):

```ts
const dataset = { ...satisfactoryDataset, recipes: satisfactoryDataset.recipes.filter(r => unlocked.has(r.id)) }
```

`--alternates` is the CLI version of exactly this, and `findRecipe()` in
[dataset.ts](../src/lib/satisfactory-sink/dataset.ts) resolves user-typed recipe
names for it (loose match, optional `Alternate:` prefix) — a picker UI wants the
same function. All that is left is storing `unlocked` per user, which is the
Firestore case described in §10 — user state, not source data.
