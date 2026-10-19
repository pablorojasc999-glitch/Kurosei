import { useCallback } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import {
  listAllPlannedExercises,
  listAllPlannedSets,
  listDays,
} from '../db/planningRepository'
import { listAllMuscleContributions, listMuscleGroups } from '../db/trainingRepository'
import { MIN_RPE_FOR_VOLUME, type MuscleContribution } from '../lib/metrics'
import { dayColumnLabel } from '../lib/weeks'
import { weekStimulusByDay } from '../lib/weekStimulus'

interface WeekStimulusProps {
  weekId: string
}

/** El relleno de una celda: más fuerte cuanto más pesa dentro de lo que se compara. */
function shade(share: number): React.CSSProperties {
  return { '--share': Math.min(share, 1) * 0.55 } as React.CSSProperties
}

/**
 * El estímulo planificado de una semana por grupo muscular, repartido por día.
 *
 * Cada fila es un músculo y cada columna un día; el relleno dice qué parte del
 * estímulo semanal de ese músculo cae en ese día, así que una celda cargada
 * delata dónde se concentra. La última fila suma el día entero para ver cuál
 * carga más en total.
 *
 * Se monta sólo mientras se mira la semana, así que cada vez que se vuelve de
 * editar un día pide los datos de nuevo y no muestra un plan viejo.
 */
export function WeekStimulus({ weekId }: WeekStimulusProps) {
  const { data } = useRemoteQuery(
    useCallback(async () => {
      const days = await listDays(weekId)
      const dayIds = days.map((d) => d.id)
      const dayIdSet = new Set(dayIds)
      const [plannedExercises, plannedSets, contributions, groups] = await Promise.all([
        listAllPlannedExercises(),
        listAllPlannedSets(),
        listAllMuscleContributions(),
        listMuscleGroups(),
      ])
      const plannedById = new Map(
        plannedExercises
          .filter((pe) => dayIdSet.has(pe.dayId))
          .map((pe) => [pe.id, { exerciseId: pe.exerciseId, dayId: pe.dayId }]),
      )
      const sets = plannedSets
        .filter((s) => plannedById.has(s.plannedExerciseId))
        .map((s) => {
          const planned = plannedById.get(s.plannedExerciseId) as { exerciseId: string; dayId: string }
          return {
            dayId: planned.dayId,
            exerciseId: planned.exerciseId,
            rpe: s.targetRpe,
            dropSet: s.dropSet,
            restPause: s.restPause,
          }
        })
      const contributionsByExercise = new Map<string, MuscleContribution[]>()
      for (const c of contributions) {
        const list = contributionsByExercise.get(c.exerciseId) ?? []
        list.push({ muscleGroupId: c.muscleGroupId, factor: c.factor })
        contributionsByExercise.set(c.exerciseId, list)
      }
      const nameById = new Map(groups.map((g) => [g.id, g.name]))
      return {
        days,
        stimulus: weekStimulusByDay(sets, dayIds, contributionsByExercise, (id) => nameById.get(id)),
      }
    }, [weekId]),
  )

  const maxDayTotal = Math.max(...(data?.stimulus.dayTotals ?? []), 0)

  return (
    <section className="elevated-section">
      <h2>Estímulo por grupo muscular</h2>
      <p className="empty-hint">
        Series planificadas con RPE de {MIN_RPE_FOR_VOLUME} o más, o sin RPE, ponderadas por lo
        que cada ejercicio trabaja cada grupo. El relleno marca qué parte del estímulo semanal de
        un músculo cae en cada día.
      </p>
      {!data ? (
        <p className="empty-hint">Calculando…</p>
      ) : data.days.length === 0 ? (
        <p className="empty-hint">Esta semana todavía no tiene días.</p>
      ) : data.stimulus.rows.length === 0 ? (
        <p className="empty-hint">Esta semana todavía no tiene series que cuenten.</p>
      ) : (
        <table className="stimulus-table">
          <thead>
            <tr>
              <th scope="col">Grupo</th>
              {data.days.map((d) => {
                const { weekday, day } = dayColumnLabel(d.date)
                return (
                  <th key={d.id} scope="col" title={d.label || undefined}>
                    <span className="stimulus-day-weekday">{weekday}</span>
                    <span className="stimulus-day-number">{day}</span>
                  </th>
                )
              })}
              <th scope="col">Sem.</th>
            </tr>
          </thead>
          <tbody>
            {data.stimulus.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.name}</th>
                {row.perDay.map((value, i) => (
                  <td
                    key={data.days[i].id}
                    className={value > 0 ? 'stimulus-cell stimulus-cell--on numeric' : 'stimulus-cell numeric'}
                    style={value > 0 ? shade(value / row.total) : undefined}
                  >
                    {value > 0 ? value.toFixed(1) : '·'}
                  </td>
                ))}
                <td className="stimulus-total numeric">{row.total.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Día</th>
              {data.stimulus.dayTotals.map((value, i) => (
                <td
                  key={data.days[i].id}
                  className={value > 0 ? 'stimulus-cell stimulus-cell--on numeric' : 'stimulus-cell numeric'}
                  style={value > 0 ? shade(value / maxDayTotal) : undefined}
                >
                  {value > 0 ? value.toFixed(1) : '·'}
                </td>
              ))}
              <td className="stimulus-total numeric">
                {data.stimulus.dayTotals.reduce((a, b) => a + b, 0).toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
