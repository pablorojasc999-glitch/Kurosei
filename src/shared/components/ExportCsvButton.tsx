import { useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { useSubmitGuard } from '../hooks/useSubmitGuard'

interface ExportCsvButtonProps {
  label?: string
  filename: string
  /** Arma el contenido recién al tocar: pide los datos a la base en ese momento, así el archivo nunca sale con lo que había al abrir la pantalla. */
  build: () => Promise<string>
}

export function ExportCsvButton({ label = 'Exportar CSV', filename, build }: ExportCsvButtonProps) {
  const { isSubmitting, guard } = useSubmitGuard()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        className="export-csv-button"
        disabled={isSubmitting}
        onClick={() =>
          void guard(async () => {
            setError(null)
            try {
              downloadCsv(filename, await build())
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo exportar')
            }
          })
        }
      >
        {isSubmitting ? 'Exportando…' : label}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  )
}
