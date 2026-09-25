import { describe, expect, it } from 'vitest'
import { moveInOrder } from './blockGridOrder'

describe('moveInOrder', () => {
  const ids = ['a', 'b', 'c']

  it('sube un elemento intercambiándolo con el anterior', () => {
    expect(moveInOrder(ids, 'b', 'up')).toEqual(['b', 'a', 'c'])
  })

  it('baja un elemento intercambiándolo con el siguiente', () => {
    expect(moveInOrder(ids, 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('el primero no sube y el último no baja', () => {
    expect(moveInOrder(ids, 'a', 'up')).toEqual(ids)
    expect(moveInOrder(ids, 'c', 'down')).toEqual(ids)
  })

  it('un id que no está deja la lista igual', () => {
    expect(moveInOrder(ids, 'z', 'up')).toEqual(ids)
  })

  it('no toca la lista original', () => {
    const original = ['a', 'b', 'c']
    moveInOrder(original, 'b', 'up')
    expect(original).toEqual(['a', 'b', 'c'])
  })

  it('una lista de uno solo se queda como está', () => {
    expect(moveInOrder(['a'], 'a', 'up')).toEqual(['a'])
    expect(moveInOrder(['a'], 'a', 'down')).toEqual(['a'])
  })
})
