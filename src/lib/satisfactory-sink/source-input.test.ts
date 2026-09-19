import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  parsePositive,
  buildSource,
  resolveQuantityPatch,
  resolveWeightPatch,
} from './source-input.ts'

describe('parsePositive', () => {
  test('blank text is empty and valid, with no value', () => {
    assert.deepEqual(parsePositive(''), { empty: true, value: undefined, valid: true })
  })

  test('whitespace-only text is treated as blank', () => {
    assert.deepEqual(parsePositive('   '), { empty: true, value: undefined, valid: true })
    assert.deepEqual(parsePositive('\t\n'), { empty: true, value: undefined, valid: true })
  })

  test('a plain positive integer parses', () => {
    assert.deepEqual(parsePositive('5'), { empty: false, value: 5, valid: true })
  })

  test('a decimal parses', () => {
    assert.deepEqual(parsePositive('2.5'), { empty: false, value: 2.5, valid: true })
  })

  test('surrounding whitespace is trimmed before parsing', () => {
    assert.deepEqual(parsePositive('  42  '), { empty: false, value: 42, valid: true })
  })

  test('a leading "+" is accepted, as Number() allows it', () => {
    assert.deepEqual(parsePositive('+3'), { empty: false, value: 3, valid: true })
  })

  test('zero is invalid', () => {
    assert.deepEqual(parsePositive('0'), { empty: false, value: undefined, valid: false })
  })

  test('negative numbers are invalid', () => {
    assert.deepEqual(parsePositive('-5'), { empty: false, value: undefined, valid: false })
    assert.deepEqual(parsePositive('-0.001'), { empty: false, value: undefined, valid: false })
  })

  test('non-numeric text is invalid', () => {
    assert.deepEqual(parsePositive('abc'), { empty: false, value: undefined, valid: false })
  })

  test('a number with trailing garbage is invalid', () => {
    assert.deepEqual(parsePositive('5abc'), { empty: false, value: undefined, valid: false })
  })

  test('Infinity and NaN text are invalid', () => {
    assert.deepEqual(parsePositive('Infinity'), { empty: false, value: undefined, valid: false })
    assert.deepEqual(parsePositive('NaN'), { empty: false, value: undefined, valid: false })
  })

  test('a very large number parses as valid', () => {
    assert.deepEqual(parsePositive('1e30'), { empty: false, value: 1e30, valid: true })
    assert.deepEqual(parsePositive('999999999999'), {
      empty: false,
      value: 999999999999,
      valid: true,
    })
  })
})

describe('buildSource', () => {
  test('a positive quantity is kept', () => {
    assert.deepEqual(buildSource('iron-ore', 5, 2), { item: 'iron-ore', quantity: 5, weight: 2 })
  })

  test('an undefined quantity omits the key entirely - not zero, not present at all', () => {
    const source = buildSource('iron-ore', undefined, 1)
    assert.deepEqual(source, { item: 'iron-ore', weight: 1 })
    assert.equal('quantity' in source, false)
  })

  test('a zero or negative quantity is dropped, same as undefined', () => {
    assert.deepEqual(buildSource('iron-ore', 0, 1), { item: 'iron-ore', weight: 1 })
    assert.deepEqual(buildSource('iron-ore', -5, 1), { item: 'iron-ore', weight: 1 })
  })

  test('a NaN or infinite quantity is dropped', () => {
    assert.deepEqual(buildSource('iron-ore', NaN, 1), { item: 'iron-ore', weight: 1 })
    assert.deepEqual(buildSource('iron-ore', Infinity, 1), { item: 'iron-ore', weight: 1 })
  })

  test('an undefined weight defaults to 1', () => {
    assert.deepEqual(buildSource('iron-ore', 5, undefined), {
      item: 'iron-ore',
      quantity: 5,
      weight: 1,
    })
  })

  test('a zero, negative, NaN or infinite weight defaults to 1', () => {
    assert.equal(buildSource('iron-ore', 5, 0).weight, 1)
    assert.equal(buildSource('iron-ore', 5, -3).weight, 1)
    assert.equal(buildSource('iron-ore', 5, NaN).weight, 1)
    assert.equal(buildSource('iron-ore', 5, Infinity).weight, 1)
  })

  test('a positive weight is kept as-is', () => {
    assert.equal(buildSource('iron-ore', 5, 3.5).weight, 3.5)
  })

  test('both quantity and weight can be dropped to defaults at once', () => {
    assert.deepEqual(buildSource('iron-ore', undefined, undefined), {
      item: 'iron-ore',
      weight: 1,
    })
  })
})

describe('resolveQuantityPatch', () => {
  test('blank text patches quantity to undefined, not zero, but the key is present', () => {
    const patch = resolveQuantityPatch('')
    assert.notEqual(patch, null)
    assert.deepEqual(patch, { quantity: undefined })
    assert.equal('quantity' in (patch as object), true)
  })

  test('whitespace-only text is treated the same as blank', () => {
    assert.deepEqual(resolveQuantityPatch('   '), { quantity: undefined })
  })

  test('a valid positive number patches quantity to that number', () => {
    assert.deepEqual(resolveQuantityPatch('120'), { quantity: 120 })
  })

  test('a decimal quantity is preserved exactly', () => {
    assert.deepEqual(resolveQuantityPatch('0.5'), { quantity: 0.5 })
  })

  test('invalid text (negative, zero, non-numeric) never produces a patch', () => {
    assert.equal(resolveQuantityPatch('-1'), null)
    assert.equal(resolveQuantityPatch('0'), null)
    assert.equal(resolveQuantityPatch('abc'), null)
    assert.equal(resolveQuantityPatch('12abc'), null)
  })

  test('a leading "+" is accepted', () => {
    assert.deepEqual(resolveQuantityPatch('+10'), { quantity: 10 })
  })

  test('a very large quantity is accepted', () => {
    assert.deepEqual(resolveQuantityPatch('1e9'), { quantity: 1e9 })
  })
})

describe('resolveWeightPatch', () => {
  test('blank text patches weight to 1', () => {
    assert.deepEqual(resolveWeightPatch(''), { weight: 1 })
  })

  test('whitespace-only text patches weight to 1', () => {
    assert.deepEqual(resolveWeightPatch('  '), { weight: 1 })
  })

  test('a valid positive number patches weight to that number', () => {
    assert.deepEqual(resolveWeightPatch('2.5'), { weight: 2.5 })
  })

  test('invalid text (negative, zero, non-numeric) never produces a patch', () => {
    assert.equal(resolveWeightPatch('-1'), null)
    assert.equal(resolveWeightPatch('0'), null)
    assert.equal(resolveWeightPatch('abc'), null)
    assert.equal(resolveWeightPatch('  '.concat('x')), null)
  })

  test('a leading "+" is accepted', () => {
    assert.deepEqual(resolveWeightPatch('+4'), { weight: 4 })
  })

  test('a very large weight is accepted', () => {
    assert.deepEqual(resolveWeightPatch('123456789012345'), { weight: 123456789012345 })
  })
})

describe('end-to-end: text field -> patch -> committed SourceProduct', () => {
  test('a blank quantity, when committed via buildSource, has no quantity key at all', () => {
    const patch = resolveQuantityPatch('')
    assert.notEqual(patch, null)
    const source = buildSource('iron-ore', (patch as { quantity: number | undefined }).quantity, 1)
    assert.deepEqual(source, { item: 'iron-ore', weight: 1 })
  })

  test('a blank weight, when committed via buildSource, becomes 1', () => {
    const patch = resolveWeightPatch('')
    assert.notEqual(patch, null)
    const source = buildSource('iron-ore', 5, (patch as { weight: number }).weight)
    assert.deepEqual(source, { item: 'iron-ore', quantity: 5, weight: 1 })
  })

  test('invalid quantity text yields no patch, so a caller cannot accidentally commit it', () => {
    assert.equal(resolveQuantityPatch('not-a-number'), null)
  })

  test('invalid weight text yields no patch, so a caller cannot accidentally commit it', () => {
    assert.equal(resolveWeightPatch('not-a-number'), null)
  })
})
