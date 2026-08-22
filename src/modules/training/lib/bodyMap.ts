export type BodyRegionKey =
  | 'pecho'
  | 'espalda'
  | 'triceps'
  | 'biceps'
  | 'hombro'
  | 'abdomen'
  | 'cuadriceps'
  | 'gluteos'
  | 'isquios'
  | 'gemelo'
  | 'antebrazos'

export const BODY_REGION_LABELS: Record<BodyRegionKey, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  hombro: 'Hombro',
  abdomen: 'Abdomen',
  cuadriceps: 'Cuádriceps',
  gluteos: 'Glúteos',
  isquios: 'Isquios',
  gemelo: 'Gemelo',
  antebrazos: 'Antebrazos',
}

const REGION_ALIASES: Record<string, BodyRegionKey> = {
  pecho: 'pecho',
  chest: 'pecho',
  espalda: 'espalda',
  back: 'espalda',
  dorsales: 'espalda',
  triceps: 'triceps',
  biceps: 'biceps',
  hombro: 'hombro',
  hombros: 'hombro',
  deltoides: 'hombro',
  deltoide: 'hombro',
  shoulder: 'hombro',
  shoulders: 'hombro',
  abdomen: 'abdomen',
  abdominales: 'abdomen',
  core: 'abdomen',
  cuadriceps: 'cuadriceps',
  quad: 'cuadriceps',
  quads: 'cuadriceps',
  quadriceps: 'cuadriceps',
  gluteos: 'gluteos',
  gluteo: 'gluteos',
  glutes: 'gluteos',
  glute: 'gluteos',
  isquios: 'isquios',
  isquiotibiales: 'isquios',
  hamstrings: 'isquios',
  hamstring: 'isquios',
  femoral: 'isquios',
  gemelo: 'gemelo',
  gemelos: 'gemelo',
  pantorrilla: 'gemelo',
  pantorrillas: 'gemelo',
  calves: 'gemelo',
  calf: 'gemelo',
  antebrazos: 'antebrazos',
  antebrazo: 'antebrazos',
  forearms: 'antebrazos',
  forearm: 'antebrazos',
}

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Matches a free-text muscle group name to one of the tracked body-map regions. */
export function matchBodyRegion(muscleGroupName: string): BodyRegionKey | null {
  return REGION_ALIASES[normalize(muscleGroupName)] ?? null
}
