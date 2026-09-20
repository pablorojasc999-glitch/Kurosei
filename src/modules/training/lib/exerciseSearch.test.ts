import { describe, expect, it } from 'vitest'
import { searchExercises } from './exerciseSearch'
import type { MuscleInvolvement, SearchableExercise } from './exerciseSearch'

const ejercicios: SearchableExercise[] = [
  { id: 'press-mil', name: 'Press militar' },
  { id: 'laterales', name: 'Elevaciones laterales' },
  { id: 'banca', name: 'Press banca' },
  { id: 'remo', name: 'Remo en T' },
  { id: 'sentadilla', name: 'Sentadilla' },
]

const implicancias: MuscleInvolvement[] = [
  { exerciseId: 'press-mil', groupName: 'Hombro', factor: 1 },
  { exerciseId: 'press-mil', groupName: 'Tríceps', factor: 0.5 },
  { exerciseId: 'laterales', groupName: 'Hombro', factor: 0.9 },
  { exerciseId: 'banca', groupName: 'Pecho', factor: 1 },
  { exerciseId: 'banca', groupName: 'Hombro', factor: 0.4 },
  { exerciseId: 'remo', groupName: 'Espalda', factor: 1 },
  { exerciseId: 'sentadilla', groupName: 'Cuádriceps', factor: 1 },
]

const buscar = (q: string) => searchExercises(q, ejercicios, implicancias)
const ids = (q: string) => buscar(q).map((r) => r.id)

describe('searchExercises', () => {
  it('sin nada escrito devuelve todo en orden alfabético', () => {
    expect(ids('')).toEqual(['laterales', 'banca', 'press-mil', 'remo', 'sentadilla'])
  })

  it('los espacios solos cuentan como no haber escrito nada', () => {
    expect(ids('   ')).toEqual(ids(''))
  })

  it('sin búsqueda no muestra factor: no es "el" factor del ejercicio', () => {
    expect(buscar('').every((r) => r.matchedGroup === null)).toBe(true)
  })

  it('busca por nombre, en orden alfabético', () => {
    expect(ids('press')).toEqual(['banca', 'press-mil'])
  })

  it('por grupo muscular ordena por implicancia, de mayor a menor', () => {
    expect(ids('hombro')).toEqual(['press-mil', 'laterales', 'banca'])
  })

  it('dice por qué músculo entró y con cuánto', () => {
    const [primero] = buscar('hombro')
    expect(primero.matchedGroup).toEqual({ name: 'Hombro', factor: 1 })
  })

  it('ignora tildes y mayúsculas en los dos lados', () => {
    expect(ids('TRICEPS')).toEqual(['press-mil'])
    expect(ids('cuadriceps')).toEqual(['sentadilla'])
  })

  it('lo que calza por nombre va antes que lo que calza por músculo', () => {
    // "Press banca" contiene "banca" en el nombre; "Press militar" sólo
    // comparte el hombro. El que se escribió gana.
    expect(ids('banca')).toEqual(['banca'])
    // Con un término que es nombre y músculo a la vez, primero el nombre.
    const conAmbos = searchExercises(
      'remo',
      ejercicios,
      [...implicancias, { exerciseId: 'sentadilla', groupName: 'Remo', factor: 1 }],
    )
    expect(conAmbos.map((r) => r.id)).toEqual(['remo', 'sentadilla'])
  })

  it('un ejercicio no se repite aunque calce por nombre y por músculo', () => {
    const conAmbos = searchExercises(
      'sentadilla',
      ejercicios,
      [...implicancias, { exerciseId: 'sentadilla', groupName: 'Sentadilla', factor: 1 }],
    )
    expect(conAmbos.map((r) => r.id)).toEqual(['sentadilla'])
  })

  it('si un ejercicio toca dos grupos que calzan, vale el más implicado', () => {
    const resultados = searchExercises(
      'deltoides',
      [{ id: 'x', name: 'Press inclinado' }],
      [
        { exerciseId: 'x', groupName: 'Deltoides posterior', factor: 0.3 },
        { exerciseId: 'x', groupName: 'Deltoides anterior', factor: 0.8 },
      ],
    )
    expect(resultados).toHaveLength(1)
    expect(resultados[0].matchedGroup).toEqual({
      name: 'Deltoides anterior',
      factor: 0.8,
    })
  })

  it('a igual implicancia desempata el orden alfabético', () => {
    const resultados = searchExercises(
      'hombro',
      [
        { id: 'b', name: 'Zancada' },
        { id: 'a', name: 'Arnold press' },
      ],
      [
        { exerciseId: 'b', groupName: 'Hombro', factor: 0.7 },
        { exerciseId: 'a', groupName: 'Hombro', factor: 0.7 },
      ],
    )
    expect(resultados.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('ignora implicancias de ejercicios que ya no están en la lista', () => {
    const resultados = searchExercises(
      'hombro',
      [{ id: 'press-mil', name: 'Press militar' }],
      implicancias,
    )
    expect(resultados.map((r) => r.id)).toEqual(['press-mil'])
  })

  it('sin resultados devuelve la lista vacía, no todo', () => {
    expect(ids('natación')).toEqual([])
  })
})
