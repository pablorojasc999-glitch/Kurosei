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
  /** The debt's current total amount; only set (non-null) when `kind` is `debt`. Payments toward it are tracked via `categoryId`'s transactions rather than editing this down — but for a `revolving` debt it's expected to be bumped back up whenever a new charge is added. */
  debtAmount: number | null
  /** Only set for a `debt` account — the auto-created category (income for `owed_to_me`, expense for `i_owe`) whose transactions track payments toward this debt. */
  categoryId: string | null
  /** Only meaningful for a `debt` account. false (default): a fixed one-off debt (a loan) that archives itself once fully paid. true: an ongoing balance (a credit card, a line of credit) that keeps accepting new charges via `debtAmount` edits and never auto-archives. */
  revolving: boolean
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
