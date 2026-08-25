import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import {
  getCategoryTotals,
  getMonthlyTotalsForYear,
  listCategories,
} from '../db/financeRepository'
import { formatMoney } from '../lib/money'
import { BalanceHeader } from './BalanceHeader'
import { YearNav } from './YearNav'

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

export function EstadisticasPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const categories = useLiveQuery(() => listCategories('expense'), [])
  const categoryTotals = useLiveQuery(() => getCategoryTotals(year), [year])
  const monthlyTotals = useLiveQuery(() => getMonthlyTotalsForYear(year), [year])

  const categoryBars = (categories ?? [])
    .map((c) => ({ category: c, total: categoryTotals?.get(c.id) ?? 0 }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
  const maxCategoryTotal = Math.max(1, ...categoryBars.map((row) => row.total))

  const maxMonthlyTotal = Math.max(
    1,
    ...(monthlyTotals ?? []).flatMap((m) => [m.expense, m.income]),
  )

  return (
    <div className="page">
      <h1>Estadísticas</h1>
      <BalanceHeader />
      <YearNav year={year} onChange={setYear} />

      <section>
        <h2>Gastos por categoría</h2>
        {categoryBars.length === 0 ? (
          <p className="empty-hint">Sin gastos registrados en {year}.</p>
        ) : (
          <ul className="finance-hbar-list">
            {categoryBars.map(({ category, total }) => (
              <li key={category.id} className="finance-hbar-row">
                <span className="finance-hbar-label">
                  {category.emoji} {category.name}
                </span>
                <div className="finance-hbar-track">
                  <div
                    className="finance-hbar-fill"
                    style={{ width: `${(total / maxCategoryTotal) * 100}%` }}
                  />
                </div>
                <span className="finance-hbar-value">{formatMoney(total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Ingresos vs gastos por mes</h2>
        <div className="finance-vbar-legend">
          <span>
            <span className="finance-vbar-legend-dot finance-vbar-legend-dot--income" />
            Ingresos
          </span>
          <span>
            <span className="finance-vbar-legend-dot finance-vbar-legend-dot--expense" />
            Gastos
          </span>
        </div>
        <div className="finance-vbar-chart">
          {(monthlyTotals ?? []).map((m) => (
            <div key={m.month} className="finance-vbar-group">
              <div className="finance-vbar-pair">
                <div
                  className="finance-vbar finance-vbar--income"
                  style={{ height: `${(m.income / maxMonthlyTotal) * 100}%` }}
                />
                <div
                  className="finance-vbar finance-vbar--expense"
                  style={{ height: `${(m.expense / maxMonthlyTotal) * 100}%` }}
                />
              </div>
              <span className="finance-vbar-label">{MONTH_LABELS[m.month]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
