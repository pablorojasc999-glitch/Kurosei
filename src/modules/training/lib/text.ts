/**
 * Normaliza un nombre para compararlo: sin espacios de sobra, en minúsculas y
 * sin tildes.
 *
 * Vive acá porque ya se comparaba igual en tres lugares (el mapa corporal, el
 * agrupado de grupos musculares y ahora el buscador de ejercicios). Que "Bíceps"
 * y "biceps" sean lo mismo tiene que significar lo mismo en toda la app: si
 * cada vista lo decide por su cuenta, tarde o temprano una acepta la tilde y
 * otra no.
 */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
