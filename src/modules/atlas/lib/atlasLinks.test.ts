import { describe, expect, it } from 'vitest'
import type { AtlasNote } from '../domain/types'
import {
  allBrokenLinks,
  buildIndex,
  normalizeTitle,
  parseLinks,
  parseTags,
  searchNotes,
} from './atlasLinks'

const note = (id: string, title: string, body = ''): AtlasNote => ({
  id,
  title,
  body,
  level: 'desarrollo',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
})

describe('parseLinks', () => {
  it('saca los enlaces del cuerpo', () => {
    expect(parseLinks('Ver [[Sentadilla]] y [[Press de banca]].')).toEqual([
      { target: 'Sentadilla', label: 'Sentadilla' },
      { target: 'Press de banca', label: 'Press de banca' },
    ])
  })

  it('acepta alias con barra: se enlaza a uno y se lee otro', () => {
    expect(parseLinks('Mejor [[Movilidad de tobillo|el tobillo]].')).toEqual([
      { target: 'Movilidad de tobillo', label: 'el tobillo' },
    ])
  })

  it('recorta espacios y no repite el mismo destino', () => {
    expect(parseLinks('[[  Sentadilla  ]] otra vez [[sentadilla]]')).toEqual([
      { target: 'Sentadilla', label: 'Sentadilla' },
    ])
  })

  it('ignora los corchetes vacíos o a medio escribir', () => {
    expect(parseLinks('[[]] y [[   ]] y [[sin cerrar')).toEqual([])
  })

  it('un enlace pegado a texto sigue valiendo', () => {
    expect(parseLinks('ver[[Sentadilla]]ahora').map((l) => l.target)).toEqual(['Sentadilla'])
  })
})

describe('parseTags', () => {
  it('saca las etiquetas', () => {
    expect(parseTags('Esto es #powerlifting y #fuerza')).toEqual(['powerlifting', 'fuerza'])
  })

  it('acepta acentos, ñ y barras para anidar', () => {
    expect(parseTags('#entrenamiento/técnica #año #niño')).toEqual([
      'entrenamiento/técnica',
      'año',
      'niño',
    ])
  })

  it('no confunde un encabezado Markdown con una etiqueta', () => {
    expect(parseTags('# Título\n## Subtítulo')).toEqual([])
  })

  it('no toma la almohadilla dentro de un enlace', () => {
    expect(parseTags('[[Nota #1]] y #real')).toEqual(['real'])
  })

  it('descarta lo que sólo son números, que suele ser una cifra', () => {
    expect(parseTags('serie #3 con #tecnica')).toEqual(['tecnica'])
  })

  it('no repite la misma etiqueta escrita distinto', () => {
    expect(parseTags('#Fuerza y #fuerza')).toEqual(['Fuerza'])
  })
})

describe('buildIndex', () => {
  const notas = [
    note('a', 'Powerlifting', 'Mis cosas: [[Sentadilla]] y [[Press de banca]]. #plan'),
    note('b', 'Sentadilla', 'Ver [[Movilidad de tobillo]]. #powerlifting #técnica'),
    note('c', 'Press de banca', 'Nada aún. #powerlifting'),
  ]

  it('resuelve los enlaces sin distinguir mayúsculas', () => {
    const index = buildIndex([note('a', 'Nota A', '[[NOTA b]]'), note('b', 'Nota B')])
    expect(index.outgoing.get('a')).toEqual(['b'])
  })

  it('los backlinks salen solos de los enlaces del otro lado', () => {
    const index = buildIndex(notas)
    expect(index.backlinks.get('b')).toEqual(['a'])
    expect(index.backlinks.get('c')).toEqual(['a'])
    // Powerlifting no recibe ninguno: nadie la enlaza.
    expect(index.backlinks.get('a')).toBeUndefined()
  })

  it('guarda aparte los enlaces que no resuelven, para poder crearlos', () => {
    const index = buildIndex(notas)
    expect(index.broken.get('b')).toEqual([
      { target: 'Movilidad de tobillo', label: 'Movilidad de tobillo' },
    ])
    expect(allBrokenLinks(index).map((l) => l.target)).toEqual(['Movilidad de tobillo'])
  })

  it('una nota que se enlaza a sí misma no ensucia el grafo', () => {
    const index = buildIndex([note('a', 'Sola', 'me cito: [[Sola]]')])
    expect(index.outgoing.get('a')).toEqual([])
    expect(index.backlinks.get('a')).toBeUndefined()
  })

  it('agrupa las notas por etiqueta', () => {
    const index = buildIndex(notas)
    expect(index.tags.get('powerlifting')).toEqual(['b', 'c'])
    expect(index.tags.get('plan')).toEqual(['a'])
  })

  it('indexa por título normalizado', () => {
    const index = buildIndex(notas)
    expect(index.byTitle.get(normalizeTitle('  POWERLIFTING '))?.id).toBe('a')
  })
})

describe('searchNotes', () => {
  const notas = [
    note('a', 'Sentadilla búlgara'),
    note('b', 'Sentadilla'),
    note('c', 'Peso muerto', 'parecido a la sentadilla'),
    note('d', 'Box squat', 'nada'),
  ]

  it('sin consulta devuelve todo en orden alfabético', () => {
    expect(searchNotes(notas, '  ').map((n) => n.title)).toEqual([
      'Box squat',
      'Peso muerto',
      'Sentadilla',
      'Sentadilla búlgara',
    ])
  })

  it('el título pesa más que el cuerpo, y la coincidencia exacta va primero', () => {
    expect(searchNotes(notas, 'sentadilla').map((n) => n.id)).toEqual(['b', 'a', 'c'])
  })

  it('no devuelve lo que no coincide en ningún sitio', () => {
    expect(searchNotes(notas, 'natación')).toEqual([])
  })
})

describe('normalizeTitle', () => {
  it('ignora mayúsculas, espacios de sobra y acentos', () => {
    expect(normalizeTitle('  TÉCNICA ')).toBe(normalizeTitle('tecnica'))
    expect(normalizeTitle('Sentadilla búlgara')).toBe('sentadilla bulgara')
    expect(normalizeTitle('Sören')).toBe('soren')
  })

  it('conserva la ñ, que sí cambia la palabra', () => {
    expect(normalizeTitle('Año')).toBe('año')
    expect(normalizeTitle('Año')).not.toBe(normalizeTitle('Ano'))
  })

  it('resuelve un enlace escrito sin acentos', () => {
    const index = buildIndex([note('a', 'Técnica'), note('b', 'Press', 'ver [[tecnica]]')])
    expect(index.outgoing.get('b')).toEqual(['a'])
    expect(index.broken.get('b')).toBeUndefined()
  })
})
