import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type FilterKind = 'eq' | 'is' | 'in' | 'gte' | 'lte'
interface Filter {
  kind: FilterKind
  col: string
  value: unknown
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ kind, col, value }) => {
    if (kind === 'in') return (value as unknown[]).includes(row[col])
    if (kind === 'gte') return (row[col] as string) >= (value as string)
    if (kind === 'lte') return (row[col] as string) <= (value as string)
    // `is` y `eq` se tratan igual acá: a esta tabla en memoria le alcanza con
    // comparar por valor, no hace falta distinguir el operador SQL real.
    return row[col] === value
  })
}

/**
 * Un cliente de Supabase de juguete para probar repositorios que ya no
 * pasan por Dexie, sin pegarle a la base real. Imita sólo la parte de la
 * API que estos repositorios usan: `select` / `insert` / `update`,
 * `eq` / `is` / `in` / `gte` / `lte`, y `maybeSingle`. El builder es
 * "thenable" como el real, así que `await client.from(t).select('*').eq(...)`
 * funciona igual sin un `.then()` ni un `.execute()` de por medio.
 */
export function createFakeSupabaseClient(
  seed: Record<string, Row[]> = {},
  errorMessage: string | null = null,
) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([table, rows]) => [table, rows.map((r) => ({ ...r }))]),
  )

  function tableRows(table: string): Row[] {
    return (tables[table] ??= [])
  }

  function from(table: string) {
    const filters: Filter[] = []
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row[] | Row = {}
    let single = false

    function execute() {
      if (errorMessage) return Promise.resolve({ data: null, error: { message: errorMessage } })

      const rows = tableRows(table)
      if (mode === 'insert') {
        const toInsert = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ ...r }))
        rows.push(...toInsert)
        return Promise.resolve({ data: null, error: null })
      }
      if (mode === 'update') {
        for (const row of rows) {
          if (matches(row, filters)) Object.assign(row, payload)
        }
        return Promise.resolve({ data: null, error: null })
      }
      // Clonadas: el Supabase real deserializa JSON fresco en cada lectura, así
      // que una fila leída nunca es la misma referencia que la tabla en
      // memoria — mutar una no debe mutar la otra, ni la que ya se devolvió.
      const found = rows.filter((r) => matches(r, filters)).map((r) => ({ ...r }))
      return Promise.resolve({
        data: single ? (found[0] ?? null) : found,
        error: null,
      })
    }

    const builder = {
      select(_cols?: string) {
        mode = 'select'
        return builder
      },
      insert(rows: Row | Row[]) {
        mode = 'insert'
        payload = rows
        return builder
      },
      update(patch: Row) {
        mode = 'update'
        payload = patch
        return builder
      },
      eq(col: string, value: unknown) {
        filters.push({ kind: 'eq', col, value })
        return builder
      },
      is(col: string, value: unknown) {
        filters.push({ kind: 'is', col, value })
        return builder
      },
      in(col: string, values: unknown[]) {
        filters.push({ kind: 'in', col, value: values })
        return builder
      },
      gte(col: string, value: unknown) {
        filters.push({ kind: 'gte', col, value })
        return builder
      },
      lte(col: string, value: unknown) {
        filters.push({ kind: 'lte', col, value })
        return builder
      },
      maybeSingle() {
        single = true
        return execute()
      },
      then(
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return execute().then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return {
    client: { from } as unknown as SupabaseClient,
    tables,
  }
}
