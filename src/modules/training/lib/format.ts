export function formatRestMinutes(seconds: number): string {
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
