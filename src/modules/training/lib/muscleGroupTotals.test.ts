import { describe, expect, it } from 'vitest'
import { mergeMuscleGroupTotals } from './muscleGroupTotals'

/** Dos filas distintas para el mismo músculo, que es justo lo que se veía duplicado. */
const NOMBRES: Record<string, string> = {
  abs1: 'Abdomen',
  abs2: 'Abdomen',
  abs3: 'Abdominales',
  cadera1: 'Cadera',
  cadera2: 'Caderas',
  quad: 'Cuádriceps',
  raro: 'Manguito rotador',
  raro2: 'manguito rotador',
}
const nameOf = (id: string) => NOMBRES[id] ?? '?'

describe('mergeMuscleGroupTotals', () => {
  it('suma en una sola fila las que son el mismo músculo', () => {
    const r = mergeMuscleGroupTotals([['abs1', 3], ['abs2', 0.3]], nameOf)
    expect(r).toEqual([{ key: 'abdomen', name: 'Abdomen', value: 3.3 }])
  })

  it('junta también los nombres que son alias del mismo músculo', () => {
    const r = mergeMuscleGroupTotals([['abs1', 1], ['abs3', 2], ['cadera1', 1], ['cadera2', 1]], nameOf)
    expect(r.map((x) => [x.name, x.value])).toEqual([
      ['Abdomen', 3],
      ['Cadera', 2],
    ])
  })

  it('usa la etiqueta canónica, no la que trae cada fila', () => {
    expect(mergeMuscleGroupTotals([['abs3', 1]], nameOf)[0].name).toBe('Abdomen')
  })

  it('ordena de mayor a menor', () => {
    const r = mergeMuscleGroupTotals([['abs1', 1], ['quad', 5], ['cadera1', 3]], nameOf)
    expect(r.map((x) => x.name)).toEqual(['Cuádriceps', 'Cadera', 'Abdomen'])
  })

  it('con el mismo total desempata por nombre', () => {
    const r = mergeMuscleGroupTotals([['quad', 1], ['abs1', 1]], nameOf)
    expect(r.map((x) => x.name)).toEqual(['Abdomen', 'Cuádriceps'])
  })

  it('un músculo fuera del mapa corporal se agrupa por su nombre', () => {
    const r = mergeMuscleGroupTotals([['raro', 2], ['raro2', 1]], nameOf)
    expect(r).toEqual([{ key: 'nombre:manguito rotador', name: 'Manguito rotador', value: 3 }])
  })

  it('sin totales devuelve una lista vacía', () => {
    expect(mergeMuscleGroupTotals([], nameOf)).toEqual([])
  })
})
