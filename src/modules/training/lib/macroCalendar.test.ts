import { describe, expect, it } from 'vitest'
import type { Day, Macrocycle, Mesocycle, StrengthSession } from '../domain/types'
import { buildMacroCalendar, startOfWeek } from './macroCalendar'
import { parseDateInput, toDateKey } from './calendarGrid'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }

const macro = (startDate: string, endDate: string): Macrocycle => ({
  id: 'macro',
  name: 'Prep',
  goal: '',
  startDate,
  endDate,
  ...base,
})

const meso = (
  id: string,
  order: number,
  startDate: string,
  endDate: string,
  name = id,
): Mesocycle => ({
  id,
  macrocycleId: 'macro',
  name,
  phaseType: 'accumulation',
  order,
  startDate,
  endDate,
  ...base,
})

// Por defecto el día viene con el plan cerrado, que es el caso que miran casi
// todas las pruebas; `planClosed: false` es el día que todavía se está armando.
const day = (id: string, date: string, planClosed = true): Day => ({
  id,
  weekId: 'w1',
  date,
  label: '',
  planClosedAt: planClosed ? '2026-08-30T10:00:00.000Z' : null,
  ...base,
})

const session = (dayId: string, ended: boolean): StrengthSession => ({
  id: `s-${dayId}`,
  dayId,
  startedAt: '2026-09-01T10:00:00.000Z',
  endedAt: ended ? '2026-09-01T11:00:00.000Z' : null,
  ...base,
})

/** Septiembre de 2026: el 1 es martes, así que la semana 1 arranca el 31/08. */
const build = (over: Partial<Parameters<typeof buildMacroCalendar>[0]> = {}) =>
  buildMacroCalendar({
    macrocycle: macro('2026-08-31', '2026-09-27'),
    mesocycles: [],
    days: [],
    sessions: [],
    today: parseDateInput('2026-09-13'),
    ...over,
  })

describe('startOfWeek', () => {
  it('la semana empieza el lunes', () => {
    // 2026-09-13 es domingo: su lunes es el 7.
    expect(toDateKey(startOfWeek(parseDateInput('2026-09-13')))).toBe('2026-09-07')
    expect(toDateKey(startOfWeek(parseDateInput('2026-09-07')))).toBe('2026-09-07')
    expect(toDateKey(startOfWeek(parseDateInput('2026-09-08')))).toBe('2026-09-07')
  })
})

describe('buildMacroCalendar', () => {
  it('una columna por semana y siete filas por columna', () => {
    const cal = build()
    expect(cal.weeks).toHaveLength(4)
    expect(cal.weeks[0].start).toBe('2026-08-31')
    for (const w of cal.weeks) expect(w.cells).toHaveLength(7)
  })

  it('numera las semanas desde 1', () => {
    expect(build().weeks.map((w) => w.number)).toEqual([1, 2, 3, 4])
  })

  it('marca el mes sólo cuando cambia', () => {
    const etiquetas = build().weeks.map((w) => w.monthLabel)
    // La primera semana arranca en agosto; la siguiente ya es septiembre.
    expect(etiquetas[0]).toBe('AGO')
    expect(etiquetas[1]).toBe('SEP')
    expect(etiquetas[2]).toBeNull()
    expect(etiquetas[3]).toBeNull()
  })

  it('apaga los días fuera del rango del macrociclo', () => {
    const cal = build()
    const primera = cal.weeks[0].cells
    // El macro empieza el lunes 31, así que ningún día de esa semana sobra.
    expect(primera.filter((c) => c.outside)).toHaveLength(0)
    // El macro termina el domingo 27: la última semana entra entera.
    expect(cal.weeks[3].cells.filter((c) => c.outside)).toHaveLength(0)
  })

  it('un macrociclo que no arranca en lunes deja fuera el principio de la semana', () => {
    const cal = build({ macrocycle: macro('2026-09-02', '2026-09-13') })
    const primera = cal.weeks[0].cells
    expect(primera.slice(0, 2).every((c) => c.outside)).toBe(true)
    expect(primera.slice(2).every((c) => c.outside)).toBe(false)
  })

  it('coloca cada día planificado en su fecha y lo numera dentro de la semana', () => {
    const cal = build({
      days: [
        day('d1', '2026-09-07'),
        day('d2', '2026-09-08'),
        day('d3', '2026-09-09'),
        day('d4', '2026-09-11'),
      ],
    })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells.map((c) => c.slot)).toEqual(['D1', 'D2', 'D3', null, 'D4', null, null])
  })

  it('numera por orden dentro de la semana, no por día de la semana', () => {
    // Si sólo entrena miércoles y viernes, esos son D1 y D2.
    const cal = build({ days: [day('d1', '2026-09-09'), day('d2', '2026-09-11')] })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells.filter((c) => c.slot).map((c) => c.slot)).toEqual(['D1', 'D2'])
  })

  it('una sesión terminada marca el día como hecho', () => {
    const cal = build({
      days: [day('d1', '2026-09-07'), day('d2', '2026-09-08')],
      sessions: [session('d1', true), session('d2', false)],
    })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells[0].state).toBe('done')
    // Empezada pero sin terminar sigue siendo plan, no hecho.
    expect(semana?.cells[1].state).toBe('planned')
  })

  it('la semana queda hecha sólo si se hizo todo lo planificado', () => {
    const cal = build({
      days: [day('d1', '2026-08-31'), day('d2', '2026-09-01')],
      sessions: [session('d1', true), session('d2', true)],
      today: parseDateInput('2026-09-20'),
    })
    expect(cal.weeks[0].state).toBe('done')

    // Con algo pendiente queda en ámbar, no en gris: gris es "no había nada".
    const aMedias = build({
      days: [day('d1', '2026-08-31'), day('d2', '2026-09-01')],
      sessions: [session('d1', true)],
      today: parseDateInput('2026-09-20'),
    })
    expect(aMedias.weeks[0].state).toBe('planned')
  })

  it('un día con el plan todavía abierto queda en borrador, no en plan listo', () => {
    const cal = build({
      days: [day('d1', '2026-09-07', false), day('d2', '2026-09-08')],
    })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells[0].state).toBe('draft')
    expect(semana?.cells[1].state).toBe('planned')
  })

  it('haber entrenado gana sobre el plan abierto', () => {
    // El día se entrenó aunque nunca se cerrara el plan: el punto tiene que
    // decir que se entrenó, que es el hecho más fuerte.
    const cal = build({
      days: [day('d1', '2026-09-07', false)],
      sessions: [session('d1', true)],
    })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells[0].state).toBe('done')
  })

  it('la semana queda en borrador si a algún día le falta cerrar el plan', () => {
    const cal = build({
      days: [day('d1', '2026-08-31', false), day('d2', '2026-09-01')],
      today: parseDateInput('2026-09-20'),
    })
    expect(cal.weeks[0].state).toBe('draft')

    // Con todos los planes cerrados vuelve a ámbar: ya no falta planificar,
    // falta entrenar.
    const cerrada = build({
      days: [day('d1', '2026-08-31'), day('d2', '2026-09-01')],
      today: parseDateInput('2026-09-20'),
    })
    expect(cerrada.weeks[0].state).toBe('planned')
  })

  it('una semana sin nada planificado queda en gris aunque sea la de hoy', () => {
    const cal = build()
    expect(cal.weeks.map((w) => w.state)).toEqual(['empty', 'empty', 'empty', 'empty'])
  })

  it('la semana de hoy se distingue', () => {
    const cal = build({ days: [day('d1', '2026-09-07')] })
    const deHoy = cal.weeks.filter((w) => w.containsToday)
    expect(deHoy).toHaveLength(1)
    expect(deHoy[0].start).toBe('2026-09-07')
    expect(deHoy[0].state).toBe('planned')
    expect(deHoy[0].cells.filter((c) => c.isToday).map((c) => c.date)).toEqual(['2026-09-13'])
  })

  it('cada semana sabe a qué mesociclo pertenece', () => {
    const cal = build({
      mesocycles: [
        meso('m1', 0, '2026-08-31', '2026-09-13'),
        meso('m2', 1, '2026-09-14', '2026-09-27'),
      ],
    })
    expect(cal.weeks.map((w) => w.mesocycleIndex)).toEqual([0, 0, 1, 1])
  })

  it('una semana fuera de todo mesociclo queda sin color', () => {
    const cal = build({ mesocycles: [meso('m1', 0, '2026-09-07', '2026-09-13')] })
    expect(cal.weeks[0].mesocycleIndex).toBe(-1)
  })

  it('el bloque se pinta desde su primer día, aunque empiece a mitad de semana', () => {
    // El macrociclo va del lunes 31/08 al domingo 27/09; el bloque arranca el
    // domingo 13/09, último día de la segunda semana.
    const cal = build({ mesocycles: [meso('m1', 0, '2026-09-13', '2026-09-27')] })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells.map((c) => c.mesocycleIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0])
  })

  it('el bloque deja de pintarse en su último día, no al terminar la semana', () => {
    // Termina el martes 15/09: el resto de esa semana ya no es del bloque.
    const cal = build({ mesocycles: [meso('m1', 0, '2026-08-31', '2026-09-15')] })
    const semana = cal.weeks.find((w) => w.start === '2026-09-14')
    expect(semana?.cells.map((c) => c.mesocycleIndex)).toEqual([0, 0, -1, -1, -1, -1, -1])
  })

  it('en la semana en que se cambia de bloque, cada día lleva el suyo', () => {
    const cal = build({
      mesocycles: [
        meso('m1', 0, '2026-08-31', '2026-09-09'),
        meso('m2', 1, '2026-09-10', '2026-09-27'),
      ],
    })
    const semana = cal.weeks.find((w) => w.start === '2026-09-07')
    expect(semana?.cells.map((c) => c.mesocycleIndex)).toEqual([0, 0, 0, 1, 1, 1, 1])
    // La cabecera elige uno solo: el que cubre más días de la semana.
    expect(semana?.mesocycleIndex).toBe(1)
  })

  it('un día fuera del macrociclo no lleva bloque aunque caiga en su rango', () => {
    // La primera columna empieza el lunes 31/08, que es el inicio del macro;
    // la última se estira hasta el 03/10, más allá del 27/09 en que termina.
    const cal = build({ mesocycles: [meso('m1', 0, '2026-08-31', '2026-10-03')] })
    const ultima = cal.weeks[cal.weeks.length - 1]
    expect(ultima.cells.map((c) => c.outside)).toEqual([
      false, false, false, false, false, false, false,
    ])
    expect(ultima.cells.every((c) => c.mesocycleIndex === 0)).toBe(true)
  })

  it('resume cada mesociclo con el estado de sus semanas', () => {
    const cal = build({
      mesocycles: [
        meso('m1', 0, '2026-08-31', '2026-09-13', 'Acumulación'),
        meso('m2', 1, '2026-09-14', '2026-09-27', 'Intensificación'),
      ],
      days: [day('d1', '2026-08-31')],
      sessions: [session('d1', true)],
      today: parseDateInput('2026-09-20'),
    })
    expect(cal.mesocycles.map((m) => m.name)).toEqual(['Acumulación', 'Intensificación'])
    expect(cal.mesocycles[0].weekStates).toEqual(['done', 'empty'])
    expect(cal.mesocycles[1].weekStates).toEqual(['empty', 'empty'])
    expect(cal.mesocycles[1].weekStates).toHaveLength(2)
  })

  it('respeta el orden del mesociclo, no el de llegada', () => {
    const cal = build({
      mesocycles: [
        meso('m2', 1, '2026-09-14', '2026-09-27', 'Segundo'),
        meso('m1', 0, '2026-08-31', '2026-09-13', 'Primero'),
      ],
    })
    expect(cal.mesocycles.map((m) => m.name)).toEqual(['Primero', 'Segundo'])
  })

  it('un macrociclo de un solo día da una sola semana', () => {
    const cal = build({ macrocycle: macro('2026-09-09', '2026-09-09') })
    expect(cal.weeks).toHaveLength(1)
    expect(cal.weeks[0].cells.filter((c) => !c.outside)).toHaveLength(1)
  })

  it('sin mesociclos ni días no se rompe', () => {
    const cal = build()
    expect(cal.mesocycles).toEqual([])
    expect(cal.weeks.every((w) => w.cells.every((c) => c.slot === null))).toBe(true)
  })
})
