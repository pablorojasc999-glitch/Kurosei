import { useLiveQuery } from 'dexie-react-hooks'
import { getAccountsTotalBalance } from '../db/financeRepository'

export function useAccountsTotalBalance(): number | undefined {
  return useLiveQuery(() => getAccountsTotalBalance(), [])
}
