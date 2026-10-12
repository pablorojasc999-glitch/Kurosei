import { useAccountsTotalBalance } from '../lib/useAccountsTotalBalance'
import { formatMoney } from '../lib/money'

export function BalanceHeader({ refreshKey }: { refreshKey?: unknown } = {}) {
  const balance = useAccountsTotalBalance(refreshKey)

  return (
    <div className="finance-balance-header">
      <span className="finance-balance-label">Saldo total</span>
      <strong className="finance-balance-amount">
        {balance !== undefined ? formatMoney(balance) : '…'}
      </strong>
    </div>
  )
}
