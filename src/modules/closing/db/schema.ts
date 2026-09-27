export const CLOSING_STORES_V11 = {
  // El índice compuesto es el que usa el buscar-o-crear: hay como mucho un
  // cierre por (fecha, módulo), y sin él habría que recorrer la tabla entera.
  day_closures: 'id, date, module, [date+module], updatedAt, deletedAt',
}
