import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  getDailyLog,
  getProfile,
  upsertDailyLog,
  upsertProfile,
} from '../db/bitacoraRepository'
import { getSessionForDay } from '../db/executionRepository'
import { listCardioSessions } from '../db/cardioRepository'
import { findDayByDate } from '../db/planningRepository'
import { estimateCalorieExpenditure } from '../lib/calorieExpenditure'
import { toDateKey } from '../lib/calendarGrid'
import type { Sex } from '../domain/types'

interface ProfileFormState {
  heightCm: string
  birthDate: string
  sex: Sex | ''
  bodyFatPercent: string
  muscleMassPercent: string
}

const EMPTY_PROFILE_FORM: ProfileFormState = {
  heightCm: '',
  birthDate: '',
  sex: '',
  bodyFatPercent: '',
  muscleMassPercent: '',
}

interface DailyLogFormState {
  bodyWeightKg: string
  calories: string
  carbsG: string
  proteinG: string
  fatG: string
  sleepHours: string
  creatineTaken: boolean
  omega3Taken: boolean
  vitaminDTaken: boolean
  waterLiters: string
  stress: string
  stimulants: string
  fatigue: string
  steps: string
}

const EMPTY_LOG_FORM: DailyLogFormState = {
  bodyWeightKg: '',
  calories: '',
  carbsG: '',
  proteinG: '',
  fatG: '',
  sleepHours: '',
  creatineTaken: false,
  omega3Taken: false,
  vitaminDTaken: false,
  waterLiters: '',
  stress: '',
  stimulants: '',
  fatigue: '',
  steps: '',
}

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

const SCALE_OPTIONS = [0, 1, 2, 3, 4, 5]

interface BitacoraSectionProps {
  date: Date
}

export function BitacoraSection({ date }: BitacoraSectionProps) {
  const dateKey = toDateKey(date)
  const profile = useLiveQuery(() => getProfile(), [])
  const dailyLog = useLiveQuery(() => getDailyLog(dateKey), [dateKey])
  const day = useLiveQuery(() => findDayByDate(date), [dateKey])
  const session = useLiveQuery(
    () => (day ? getSessionForDay(day.id) : Promise.resolve(undefined)),
    [day?.id],
  )
  const cardioSessions = useLiveQuery(
    () => (day ? listCardioSessions(day.id) : Promise.resolve([])),
    [day?.id],
  )

  const [showProfileForm, setShowProfileForm] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM)
  const [appliedProfileKey, setAppliedProfileKey] = useState<string | null>(null)

  const [logForm, setLogForm] = useState<DailyLogFormState>(EMPTY_LOG_FORM)
  const [appliedLogKey, setAppliedLogKey] = useState<string | null>(null)

  const { isSubmitting: isSubmittingProfile, guard: guardProfile } = useSubmitGuard()
  const { isSubmitting: isSubmittingLog, guard: guardLog } = useSubmitGuard()

  const profileLoadKey = profile === undefined ? null : (profile?.id ?? 'empty')
  if (profileLoadKey !== null && profileLoadKey !== appliedProfileKey) {
    setAppliedProfileKey(profileLoadKey)
    setProfileForm(
      profile
        ? {
            heightCm: profile.heightCm?.toString() ?? '',
            birthDate: profile.birthDate ?? '',
            sex: profile.sex ?? '',
            bodyFatPercent: profile.bodyFatPercent?.toString() ?? '',
            muscleMassPercent: profile.muscleMassPercent?.toString() ?? '',
          }
        : EMPTY_PROFILE_FORM,
    )
  }

  const logLoadKey = dailyLog === undefined ? null : `${dateKey}:${dailyLog?.id ?? 'empty'}`
  if (logLoadKey !== null && logLoadKey !== appliedLogKey) {
    setAppliedLogKey(logLoadKey)
    setLogForm(
      dailyLog
        ? {
            bodyWeightKg: dailyLog.bodyWeightKg?.toString() ?? '',
            calories: dailyLog.calories?.toString() ?? '',
            carbsG: dailyLog.carbsG?.toString() ?? '',
            proteinG: dailyLog.proteinG?.toString() ?? '',
            fatG: dailyLog.fatG?.toString() ?? '',
            sleepHours: dailyLog.sleepHours?.toString() ?? '',
            creatineTaken: dailyLog.creatineTaken,
            omega3Taken: dailyLog.omega3Taken,
            vitaminDTaken: dailyLog.vitaminDTaken,
            waterLiters: dailyLog.waterLiters?.toString() ?? '',
            stress: dailyLog.stress?.toString() ?? '',
            stimulants: dailyLog.stimulants?.toString() ?? '',
            fatigue: dailyLog.fatigue?.toString() ?? '',
            steps: dailyLog.steps?.toString() ?? '',
          }
        : EMPTY_LOG_FORM,
    )
  }

  if (profile === undefined || dailyLog === undefined) {
    return null
  }

  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault()
    await guardProfile(async () => {
      await upsertProfile({
        heightCm: parseNum(profileForm.heightCm),
        birthDate: profileForm.birthDate || null,
        sex: profileForm.sex || null,
        bodyFatPercent: parseNum(profileForm.bodyFatPercent),
        muscleMassPercent: parseNum(profileForm.muscleMassPercent),
      })
      setShowProfileForm(false)
    })
  }

  async function handleSubmitLog(e: React.FormEvent) {
    e.preventDefault()
    await guardLog(async () => {
      await upsertDailyLog(dateKey, {
        bodyWeightKg: parseNum(logForm.bodyWeightKg),
        calories: parseNum(logForm.calories),
        carbsG: parseNum(logForm.carbsG),
        proteinG: parseNum(logForm.proteinG),
        fatG: parseNum(logForm.fatG),
        sleepHours: parseNum(logForm.sleepHours),
        creatineTaken: logForm.creatineTaken,
        omega3Taken: logForm.omega3Taken,
        vitaminDTaken: logForm.vitaminDTaken,
        waterLiters: parseNum(logForm.waterLiters),
        stress: parseNum(logForm.stress),
        stimulants: parseNum(logForm.stimulants),
        fatigue: parseNum(logForm.fatigue),
        steps: parseNum(logForm.steps),
      })
    })
  }

  const profileSummary = profile
    ? [
        profile.heightCm !== null ? `${profile.heightCm} cm` : null,
        profile.sex === 'male' ? 'Hombre' : profile.sex === 'female' ? 'Mujer' : null,
        profile.bodyFatPercent !== null ? `${profile.bodyFatPercent}% grasa` : null,
        profile.muscleMassPercent !== null ? `${profile.muscleMassPercent}% músculo` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const cardioCaloriesBurned = (cardioSessions ?? []).reduce(
    (sum, c) => sum + (c.caloriesBurned ?? 0),
    0,
  )
  const strengthSessionDurationMinutes =
    session?.startedAt && session?.endedAt
      ? (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
      : 0

  const profileComplete =
    profile?.heightCm != null && profile?.birthDate != null && profile?.sex != null
  const weightKg = dailyLog?.bodyWeightKg ?? null

  let expenditure: number | null = null
  if (profileComplete && weightKg !== null) {
    expenditure = estimateCalorieExpenditure({
      heightCm: profile.heightCm as number,
      birthDate: profile.birthDate as string,
      sex: profile.sex as Sex,
      weightKg,
      targetDate: date,
      cardioCaloriesBurned,
      strengthSessionDurationMinutes,
    })
  }

  return (
    <section>
      <h2>Bitácora</h2>

      <div className="bitacora-profile">
        {showProfileForm ? (
          <form onSubmit={handleSubmitProfile} className="entity-form">
            <label>
              Estatura (cm)
              <input
                type="number"
                inputMode="decimal"
                value={profileForm.heightCm}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, heightCm: e.target.value }))
                }
              />
            </label>
            <label>
              Fecha de nacimiento
              <input
                type="date"
                value={profileForm.birthDate}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, birthDate: e.target.value }))
                }
              />
            </label>
            <label>
              Sexo
              <select
                value={profileForm.sex}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    sex: e.target.value as Sex | '',
                  }))
                }
              >
                <option value="">Sin especificar</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
              </select>
            </label>
            <label>
              % Grasa corporal (opcional, se actualiza cuando te evalúan)
              <input
                type="number"
                inputMode="decimal"
                value={profileForm.bodyFatPercent}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, bodyFatPercent: e.target.value }))
                }
              />
            </label>
            <label>
              % Masa muscular (opcional, se actualiza cuando te evalúan)
              <input
                type="number"
                inputMode="decimal"
                value={profileForm.muscleMassPercent}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, muscleMassPercent: e.target.value }))
                }
              />
            </label>
            <button type="submit" disabled={isSubmittingProfile}>Guardar perfil</button>
            <button type="button" onClick={() => setShowProfileForm(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <div className="bitacora-profile-summary">
            <span>{profileSummary || 'Completa tu perfil para calcular el gasto calórico.'}</span>
            <button type="button" onClick={() => setShowProfileForm(true)}>
              {profile ? 'Editar perfil' : 'Completar perfil'}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmitLog} className="entity-form bitacora-log-form">
        <label>
          Peso corporal (kg)
          <input
            type="number"
            inputMode="decimal"
            value={logForm.bodyWeightKg}
            onChange={(e) => setLogForm((prev) => ({ ...prev, bodyWeightKg: e.target.value }))}
          />
        </label>
        <label>
          Calorías
          <input
            type="number"
            inputMode="decimal"
            value={logForm.calories}
            onChange={(e) => setLogForm((prev) => ({ ...prev, calories: e.target.value }))}
          />
        </label>
        <label>
          Carbohidratos (g)
          <input
            type="number"
            inputMode="decimal"
            value={logForm.carbsG}
            onChange={(e) => setLogForm((prev) => ({ ...prev, carbsG: e.target.value }))}
          />
        </label>
        <label>
          Proteína (g)
          <input
            type="number"
            inputMode="decimal"
            value={logForm.proteinG}
            onChange={(e) => setLogForm((prev) => ({ ...prev, proteinG: e.target.value }))}
          />
        </label>
        <label>
          Grasa (g)
          <input
            type="number"
            inputMode="decimal"
            value={logForm.fatG}
            onChange={(e) => setLogForm((prev) => ({ ...prev, fatG: e.target.value }))}
          />
        </label>
        <label>
          Horas de sueño
          <input
            type="number"
            inputMode="decimal"
            value={logForm.sleepHours}
            onChange={(e) => setLogForm((prev) => ({ ...prev, sleepHours: e.target.value }))}
          />
        </label>
        <label>
          Agua (litros)
          <input
            type="number"
            inputMode="decimal"
            value={logForm.waterLiters}
            onChange={(e) => setLogForm((prev) => ({ ...prev, waterLiters: e.target.value }))}
          />
        </label>
        <label>
          Pasos
          <input
            type="number"
            inputMode="numeric"
            value={logForm.steps}
            onChange={(e) => setLogForm((prev) => ({ ...prev, steps: e.target.value }))}
          />
        </label>
        <label>
          Estrés (0 a 5)
          <select
            value={logForm.stress}
            onChange={(e) => setLogForm((prev) => ({ ...prev, stress: e.target.value }))}
          >
            <option value="">Sin registrar</option>
            {SCALE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estimulantes (0 a 5)
          <select
            value={logForm.stimulants}
            onChange={(e) => setLogForm((prev) => ({ ...prev, stimulants: e.target.value }))}
          >
            <option value="">Sin registrar</option>
            {SCALE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fatiga (0 a 5)
          <select
            value={logForm.fatigue}
            onChange={(e) => setLogForm((prev) => ({ ...prev, fatigue: e.target.value }))}
          >
            <option value="">Sin registrar</option>
            {SCALE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="bitacora-supplements">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={logForm.creatineTaken}
              onChange={(e) =>
                setLogForm((prev) => ({ ...prev, creatineTaken: e.target.checked }))
              }
            />
            Creatina
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={logForm.omega3Taken}
              onChange={(e) =>
                setLogForm((prev) => ({ ...prev, omega3Taken: e.target.checked }))
              }
            />
            Omega 3
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={logForm.vitaminDTaken}
              onChange={(e) =>
                setLogForm((prev) => ({ ...prev, vitaminDTaken: e.target.checked }))
              }
            />
            Vitamina D
          </label>
        </div>
        <button type="submit" disabled={isSubmittingLog}>Guardar bitácora</button>
      </form>

      <div className="bitacora-expenditure">
        <span className="bitacora-expenditure-label">Gasto calórico estimado</span>
        {expenditure !== null ? (
          <span className="numeric bitacora-expenditure-value">
            {Math.round(expenditure)} kcal
          </span>
        ) : (
          <span className="empty-hint">
            {!profileComplete
              ? 'Completa tu perfil (estatura, fecha de nacimiento y sexo) para calcularlo.'
              : 'Registra tu peso corporal de hoy para calcularlo.'}
          </span>
        )}
      </div>
    </section>
  )
}
