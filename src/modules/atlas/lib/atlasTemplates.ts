import type { MasteryLevel } from '../domain/types'

export interface TemplateNodeSpec {
  name: string
  level: MasteryLevel
  children?: TemplateNodeSpec[]
}

export interface AtlasTemplate {
  id: string
  name: string
  description: string
  /** La raíz del perfil; su nombre es el del perfil. */
  root: TemplateNodeSpec
}

/**
 * Bases desde las que arrancar un perfil, tal como las lista el estado vacío
 * del diseño. `en-blanco` deja solo la raíz con el nombre que le pongas.
 */
export const ATLAS_TEMPLATES: AtlasTemplate[] = [
  {
    id: 'powerlifting',
    name: 'Powerlifting',
    description: '3 levantamientos, técnica y recuperación',
    root: {
      name: 'Powerlifting',
      level: 'desarrollo',
      children: [
        {
          name: 'Sentadilla',
          level: 'desarrollo',
          children: [
            { name: 'Movilidad de tobillo', level: 'principiante' },
            { name: 'Bracing / Valsalva', level: 'dominado' },
          ],
        },
        {
          name: 'Press de banca',
          level: 'dominado',
          children: [{ name: 'Arco y set-up', level: 'dominado' }],
        },
        {
          name: 'Peso muerto',
          level: 'principiante',
          children: [{ name: 'Bisagra de cadera', level: 'desarrollo' }],
        },
        {
          name: 'Recuperación',
          level: 'principiante',
          children: [{ name: 'Sueño 8 h', level: 'principiante' }],
        },
      ],
    },
  },
  {
    id: 'emprendedor-ia',
    name: 'Emprendedor de IA',
    description: 'Producto, evals, distribución, capital',
    root: {
      name: 'Emprendedor de IA',
      level: 'principiante',
      children: [
        {
          name: 'Producto',
          level: 'desarrollo',
          children: [
            { name: 'Descubrimiento de usuario', level: 'principiante' },
            { name: 'Diseño de producto', level: 'desarrollo' },
          ],
        },
        {
          name: 'Evals',
          level: 'principiante',
          children: [
            { name: 'Datasets de prueba', level: 'principiante' },
            { name: 'Métricas de calidad', level: 'principiante' },
          ],
        },
        {
          name: 'Distribución',
          level: 'principiante',
          children: [{ name: 'Contenido técnico', level: 'dominado' }],
        },
        {
          name: 'Capital',
          level: 'desarrollo',
          children: [
            { name: 'Modelo de negocio', level: 'desarrollo' },
            { name: 'Costos de inferencia', level: 'dominado' },
          ],
        },
      ],
    },
  },
  {
    id: 'en-blanco',
    name: 'En blanco',
    description: 'Un solo nodo raíz con el nombre que le pongas',
    root: { name: 'En blanco', level: 'desarrollo' },
  },
]

export function countTemplateNodes(spec: TemplateNodeSpec): number {
  return 1 + (spec.children ?? []).reduce((sum, child) => sum + countTemplateNodes(child), 0)
}
