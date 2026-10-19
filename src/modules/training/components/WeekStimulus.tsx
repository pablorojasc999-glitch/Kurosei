import { useCallback } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import {
  listAllPlannedExercises,
  listAllPlannedSets,
  listDays,
} from '../db/planningRepository'
import { listAllMuscleContributions, listMuscleGroups } from '../db/trainingRepository'
import { MIN_RPE_FOR_VOLUME, type MuscleContribution } from '../lib/metrics'
import { weekStimulusByGroup } from '../lib/weekStimulus'

interface WeekStimulusProps {
  weekId: string
}

/**
 * El estímulo planificado de una semana por grupo muscular.
 *
 * Se monta sólo mientras se mira la semana, así que cada vez que se vuelve de
 * editar un día pide los datos de nuevo y no muestra un plan viejo.
 */
export function WeekStimulus({ weekId }: WeekStimulusProps) {
  const { data } = useRemoteQuery(
    useCallback(async () => {
      const days = await listDays(weekId)
      const dayIds = new Set(days.map((d) => d.id))
      const [plannedExercises, plannedSets, contributions, groups] = await Promise.all([
        listAllPlannedExercises(),
        listAllPlannedSets(),
        listAllMuscleContributions(),
        listMuscleGroups(),
      ])
      const exerciseByPlanned = new Map(
        plannedExercises.filter((pe) => dayIds.has(pe.dayId)).map((pe) => [pe.id, pe.exerciseId]),
      )
      const sets = plannedSets
        .filter((s) => exerciseByPlanned.has(s.plannedExerciseId))
        .map((s) => ({
          exerciseId: exerciseByPlanned.get(s.plannedExerciseId) as string,
          rpe: s.targetRpe,
          dropSet: s.dropSet,
          restPause: s.restPause,
        }))
      const contributionsByExercise = new Map<string, MuscleContribution[]>()
      for (const c of contributions) {
        const list = contributionsByExercise.get(c.exerciseId) ?? []
        list.push({ muscleGroupId: c.muscleGroupId, factor: c.factor })
        contributionsByExercise.set(c.exerciseId, list)
      }
      const nameById = new Map(groups.map((g) => [g.id, g.name]))
      return weekStimulusByGroup(sets, contributionsByExercise, (id) => nameById.get(id))
    }, [weekId]),
  )

  const max = Math.max(...(data ?? []).map((g) => g.value), 0)

  return (
    <section className="elevated-section">
      <h2>Estímulo por grupo muscular</h2>
      <p className="empty-hint">
        Series planificadas con RPE de {MIN_RPE_FOR_VOLUME} o más, o sin RPE, ponderadas por lo
        que cada ejercicio trabaja cada grupo.
      </p>
      {!data ? (
        <p className="empty-hint">Calculando…</p>
      ) : data.length === 0 ? (
        <p className="empty-hint">Esta semana todavía no tiene series que cuenten.</p>
      ) : (
        <ul className="volume-bars">
          {data.map((g) => (
            <li key={g.key} className="volume-bar-row">
              <span className="volume-bar-label">{g.name}</span>
              <div className="volume-bar-track">
                <div className="volume-bar-fill" style={{ width: `${(g.value / max) * 100}%` }} />
              </div>
              <span className="volume-bar-value numeric">{g.value.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
