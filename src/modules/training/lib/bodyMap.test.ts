import { describe, expect, it } from 'vitest'
import { matchBodyRegion } from './bodyMap'

describe('matchBodyRegion', () => {
  it('matches the exact Spanish names the user uses', () => {
    expect(matchBodyRegion('Pecho')).toBe('pecho')
    expect(matchBodyRegion('Espalda')).toBe('espalda')
    expect(matchBodyRegion('Triceps')).toBe('triceps')
    expect(matchBodyRegion('Biceps')).toBe('biceps')
    expect(matchBodyRegion('Hombro')).toBe('hombro')
    expect(matchBodyRegion('Abdomen')).toBe('abdomen')
    expect(matchBodyRegion('Cuadriceps')).toBe('cuadriceps')
    expect(matchBodyRegion('Gluteos')).toBe('gluteos')
    expect(matchBodyRegion('Isquios')).toBe('isquios')
    expect(matchBodyRegion('Gemelo')).toBe('gemelo')
    expect(matchBodyRegion('Antebrazos')).toBe('antebrazos')
    expect(matchBodyRegion('Lumbar')).toBe('lumbar')
    expect(matchBodyRegion('Cadera')).toBe('cadera')
    expect(matchBodyRegion('Aductores')).toBe('aductores')
  })

  it('is accent- and case-insensitive', () => {
    expect(matchBodyRegion('CUÁDRICEPS')).toBe('cuadriceps')
    expect(matchBodyRegion('glúteos')).toBe('gluteos')
    expect(matchBodyRegion('  Bíceps  ')).toBe('biceps')
  })

  it('matches common English/alias spellings', () => {
    expect(matchBodyRegion('Chest')).toBe('pecho')
    expect(matchBodyRegion('Hamstrings')).toBe('isquios')
    expect(matchBodyRegion('Calves')).toBe('gemelo')
    expect(matchBodyRegion('Hips')).toBe('cadera')
    expect(matchBodyRegion('Adductors')).toBe('aductores')
    expect(matchBodyRegion('Lower back')).toBe('lumbar')
  })

  it('returns null for an unrecognized name', () => {
    expect(matchBodyRegion('Trapecio')).toBeNull()
  })
})
