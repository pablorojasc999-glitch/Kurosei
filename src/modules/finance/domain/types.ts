import type { SyncedEntity } from '../../training/domain/types'

/** `account` holds real money and its balance is derived from transactions. `debt` (CAE, tarjeta de crédito, dinero que me deben) tracks a manually-entered amount instead. */
export type FinanceAccountKind = 'account' | 'debt'

/** Only meaningful for a `debt` account: who owes whom. */
export type DebtDirection = 'i_owe' | 'owed_to_me'

export interface FinanceAccount extends SyncedEntity {
  name: string
  emoji: string
  kind: FinanceAccountKind
  debtDirection: DebtDirection | null
  /** Manually-entered current amount owed; only set (non-null) when `kind` is `debt`. */
  debtAmount: number | null
  order: number
}

export type FinanceCategoryType = 'expense' | 'income'

export interface FinanceCategory extends SyncedEntity {
  name: string
  emoji: string
  type: FinanceCategoryType
  order: number
  /** Only meaningful for an `expense` category; null means no budget set. */
  monthlyBudget: number | null
}

export interface FinanceTransaction extends SyncedEntity {
  accountId: string
  categoryId: string
  /** Denormalized from the category at creation time, so a later category edit can't silently reclassify past transactions. */
  type: FinanceCategoryType
  amount: number
  /** `YYYY-MM-DD` calendar date of the transaction. */
  date: string
  notes: string
}
