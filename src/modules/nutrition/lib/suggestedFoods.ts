import type { FoodItem, NutritionEntry } from '../domain/types'

/** Un alimento propuesto, con la cantidad que se usó la última vez en vez de la porción de la biblioteca: si siempre anotas 150 g de pollo, el atajo tiene que poner 150 y no los 100 con los que se creó. */
export interface SuggestedFood {
  food: FoodItem
  /** La última cantidad registrada de este alimento. */
  quantity: number
}

export interface SuggestedFoodsOptions {
  /** Fecha (`YYYY-MM-DD`) desde la que un registro cuenta como reciente. */
  recentSince: string
  /** Cuántos alimentos devolver en cada grupo. */
  limit?: number
}

export interface SuggestedFoods {
  /** Lo registrado desde `recentSince`, lo último primero. */
  recent: SuggestedFood[]
  /** Lo más repetido en toda la ventana, sin repetir lo que ya salió en `recent`. */
  frequent: SuggestedFood[]
}

/**
 * Qué ofrecer al abrir el panel de agregar, antes de que la persona escriba nada.
 *
 * Con el buscador vacío la lista no mostraba nada, así que había que escribir
 * sí o sí. Pero se come casi siempre lo mismo: si al abrir están lo de ayer y
 * lo de siempre, el caso normal deja de necesitar el teclado.
 *
 * Son dos grupos y no uno porque responden a cosas distintas: "reciente" sirve
 * cuando repites la comida del día anterior, y "frecuente" cuando vuelves a algo
 * que comes cada semana. Ordenar sólo por uno de los dos criterios deja fuera la
 * mitad de los casos.
 */
export function suggestedFoods(
  foods: FoodItem[],
  entries: NutritionEntry[],
  { recentSince, limit = 6 }: SuggestedFoodsOptions,
): SuggestedFoods {
  const foodById = new Map(foods.map((food) => [food.id, food]))

  // Un registro manual no tiene alimento que proponer, y uno que apunta a un
  // alimento ya borrado de la biblioteca no se puede volver a agregar.
  const logged = entries.filter(
    (entry) => entry.kind === 'food' && entry.foodId !== null && foodById.has(entry.foodId),
  )

  // De más nuevo a más viejo, para que el primero que se vea de cada alimento
  // sea el que manda tanto en el orden de "recent" como en la cantidad.
  const newestFirst = [...logged].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : -1
  })

  const timesLogged = new Map<string, number>()
  const lastQuantity = new Map<string, number>()
  const recentIds: string[] = []

  for (const entry of newestFirst) {
    const foodId = entry.foodId as string
    timesLogged.set(foodId, (timesLogged.get(foodId) ?? 0) + 1)
    if (!lastQuantity.has(foodId)) {
      lastQuantity.set(foodId, entry.quantity ?? (foodById.get(foodId) as FoodItem).servingAmount)
    }
    if (entry.date >= recentSince && !recentIds.includes(foodId)) recentIds.push(foodId)
  }

  const suggest = (foodId: string): SuggestedFood => ({
    food: foodById.get(foodId) as FoodItem,
    quantity: lastQuantity.get(foodId) as number,
  })

  const recent = recentIds.slice(0, limit).map(suggest)
  const alreadyShown = new Set(recent.map((s) => s.food.id))

  const frequent = [...timesLogged.keys()]
    .filter((foodId) => !alreadyShown.has(foodId))
    .sort((a, b) => {
      const byTimes = (timesLogged.get(b) as number) - (timesLogged.get(a) as number)
      if (byTimes !== 0) return byTimes
      const nameA = (foodById.get(a) as FoodItem).name
      const nameB = (foodById.get(b) as FoodItem).name
      return nameA.localeCompare(nameB, 'es')
    })
    .slice(0, limit)
    .map(suggest)

  return { recent, frequent }
}
