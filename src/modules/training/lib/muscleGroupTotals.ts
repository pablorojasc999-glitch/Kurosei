import { matchBodyRegion, BODY_REGION_LABELS } from './bodyMap'
import { normalizeText } from './text'

export interface MuscleGroupTotal {
  /** Clave estable para la lista: la región, o el nombre normalizado si no es una región conocida. */
  key: string
  name: string
  value: number
}

/**
 * Junta los totales por grupo muscular en una fila por músculo.
 *
 * Se agrupa por región del mapa corporal y no por id porque un mismo músculo
 * puede tener más de una fila en la biblioteca —quedan al sincronizar entre
 * dispositivos, o de haberlo creado con otro nombre antes de que existieran
 * los alias—. Sumando por id el mismo músculo sale dos veces ("Abdomen: 3.0"
 * y "Abdomen: 0.3") en lugar de una con el total.
 *
 * El mapa corporal ya juntaba por región; esto es el mismo criterio para las
 * listas, que es donde se veía el doble.
 */
export function mergeMuscleGroupTotals(
  totalsById: Iterable<readonly [string, number]>,
  nameOf: (id: string) => string,
): MuscleGroupTotal[] {
  const merged = new Map<string, MuscleGroupTotal>()
  for (const [id, value] of totalsById) {
    const name = nameOf(id)
    const region = matchBodyRegion(name)
    // Sin región conocida se agrupa por el nombre, que al menos junta dos
    // filas escritas igual; el nombre que se muestra es el primero que llegó.
    const key = region ?? `nombre:${normalizeText(name)}`
    const existing = merged.get(key)
    if (existing) {
      existing.value += value
    } else {
      merged.set(key, { key, name: region ? BODY_REGION_LABELS[region] : name, value })
    }
  }
  return [...merged.values()].sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'),
  )
}
