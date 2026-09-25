/**
 * Las repeticiones que se guardan de un campo de texto.
 *
 * Son un número entero por definición: no existe media repetición. Y la
 * columna que las recibe al sincronizar es `integer`, así que un "5.5" que se
 * cuela por un dedo torcido no rompe la pantalla —Dexie lo guarda igual— sino
 * la sincronización entera de esa tabla, y en silencio hasta que alguien mira
 * el menú de la cuenta.
 *
 * Por eso se redondea acá, al leer el formulario, y no se confía en el `step`
 * del input: pegar un valor se salta el `step`.
 */
export function parseReps(value: string): number {
  return Math.round(Number(value))
}
