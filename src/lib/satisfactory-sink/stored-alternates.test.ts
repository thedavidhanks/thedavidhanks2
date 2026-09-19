import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { readStoredIds } from './stored-alternates.ts'

describe('readStoredIds', () => {
  test('missing key (null raw value) returns an empty set', () => {
    assert.deepEqual(readStoredIds(null), new Set())
  })

  test('empty string raw value returns an empty set', () => {
    assert.deepEqual(readStoredIds(''), new Set())
  })

  test('JSON that parses to a non-array returns an empty set', () => {
    assert.deepEqual(readStoredIds(JSON.stringify({ a: 1 })), new Set())
    assert.deepEqual(readStoredIds(JSON.stringify('just-a-string')), new Set())
    assert.deepEqual(readStoredIds(JSON.stringify(42)), new Set())
    assert.deepEqual(readStoredIds(JSON.stringify(null)), new Set())
  })

  test('malformed JSON that makes JSON.parse throw returns an empty set', () => {
    assert.deepEqual(readStoredIds('{not valid json'), new Set())
    assert.deepEqual(readStoredIds('undefined'), new Set())
  })

  test('array with non-string members drops the non-string entries', () => {
    const result = readStoredIds(JSON.stringify(['alt:a', 1, null, { id: 'alt:b' }, 'alt:c']))
    assert.deepEqual(result, new Set(['alt:a', 'alt:c']))
  })

  test('empty array returns an empty set', () => {
    assert.deepEqual(readStoredIds(JSON.stringify([])), new Set())
  })

  test('duplicates collapse into a single entry', () => {
    const result = readStoredIds(JSON.stringify(['alt:a', 'alt:a', 'alt:b']))
    assert.deepEqual(result, new Set(['alt:a', 'alt:b']))
    assert.equal(result.size, 2)
  })

  test('a well-formed array of ids round-trips intact', () => {
    const ids = ['alt:pure-iron-ingot', 'alt:turbo-motor']
    assert.deepEqual(readStoredIds(JSON.stringify(ids)), new Set(ids))
  })
})
