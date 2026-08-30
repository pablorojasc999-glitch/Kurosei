export const NUTRITION_STORES_V5 = {
  nutrition_foods: 'id, name, order, updatedAt, deletedAt',
  nutrition_meal_sections: 'id, order, updatedAt, deletedAt',
  nutrition_entries: 'id, date, sectionId, foodId, updatedAt, deletedAt',
  nutrition_water_entries: 'id, date, updatedAt, deletedAt',
  nutrition_meal_templates: 'id, order, updatedAt, deletedAt',
  nutrition_meal_template_entries: 'id, templateId, sectionId, updatedAt, deletedAt',
}

export const NUTRITION_STORES_V6 = {
  nutrition_goal_plans: 'id, startDate, endDate, order, updatedAt, deletedAt',
}
