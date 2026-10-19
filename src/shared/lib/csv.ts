export type CsvCell = string | number | boolean | null | undefined

/**
 * Punto y coma y coma decimal: es lo que esperan Excel y Sheets con la
 * configuración regional de Chile. Con coma como separador la hoja abre todo
 * pegado en una sola columna, y con punto decimal los números llegan como texto.
 */
const SEPARATOR = ';'

/** Para que Excel reconozca el UTF-8 y no rompa tildes ni eñes. */
const BOM = '﻿'

function formatCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'boolean') return cell ? 'Sí' : 'No'
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return ''
    // Cuatro decimales cortan el ruido de coma flotante (0.1 + 0.2) sin
    // recortar nada que se vea en pantalla.
    return String(Number(cell.toFixed(4))).replace('.', ',')
  }
  if (/[";\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

/** Arma el CSV completo: encabezado y filas, separadas por CRLF como pide el estándar. */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(formatCell).join(SEPARATOR))
  return BOM + lines.join('\r\n') + '\r\n'
}

/** Dispara la descarga de un archivo de texto desde el navegador. */
export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
