import { db } from '../../../shared/db/database'
import { buildDayCompletion, type DayCompletion } from '../lib/dayCompletion'
import { listClosuresInRange } from './closingRepository'

/**
 * El estado de cada día de un rango, ambas fechas incluidas.
 *
 * Se leen los cierres y las bitácoras del rango de una vez y se arma todo en
 * memoria: el calendario pide un mes entero, y una consulta por día serían
 * sesenta viajes a Dexie por cada mes que se pasa.
 */
export async function listDayCompletions(
  from: string,
  to: string,
): Promise<DayCompletion[]> {
  const closures = await listClosuresInRange(from, to)
  const logs = await db.training_daily_logs
    .where('date')
    .between(from, to, true, true)
    .filter((l) => l.deletedAt === null)
    .toArray()

  const closuresByDate = new Map<string, typeof closures>()
  for (const closure of closures) {
    const list = closuresByDate.get(closure.date)
    if (list) list.push(closure)
    else closuresByDate.set(closure.date, [closure])
  }
  const logByDate = new Map(logs.map((l) => [l.date, l]))

  const days: DayCompletion[] = []
  const [fromY, fromM, fromD] = from.split('-').map(Number)
  const cursor = new Date(fromY, fromM - 1, fromD)
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`
    if (key > to) break
    days.push(
      buildDayCompletion({
        date: key,
        closures: closuresByDate.get(key) ?? [],
        log: logByDate.get(key),
      }),
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
