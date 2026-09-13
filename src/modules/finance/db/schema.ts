export const FINANCE_STORES_V4 = {
  finance_accounts: 'id, kind, order, updatedAt, deletedAt',
  finance_categories: 'id, type, order, updatedAt, deletedAt',
  finance_transactions: 'id, accountId, categoryId, date, updatedAt, deletedAt',
}

export const FINANCE_STORES_V10 = {
  finance_transactions: 'id, accountId, categoryId, date, financialMonth, updatedAt, deletedAt',
  finance_category_budgets: 'id, categoryId, effectiveFrom, updatedAt, deletedAt',
}
