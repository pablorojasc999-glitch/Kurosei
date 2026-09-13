import { describe, expect, it } from 'vitest'
import { isFieldOutOfView } from './focusedFieldVisibility'

/** Alto visible con el teclado abierto en un teléfono: la pantalla menos el teclado. */
const VISIBLE = 420

describe('isFieldOutOfView', () => {
  it('un campo en mitad de lo visible está bien', () => {
    expect(isFieldOutOfView({ top: 180, bottom: 224 }, VISIBLE)).toBe(false)
  })

  it('detecta el campo que quedó debajo del teclado', () => {
    expect(isFieldOutOfView({ top: 600, bottom: 644 }, VISIBLE)).toBe(true)
  })

  it('detecta el campo que quedó por encima, al desplazarse de más', () => {
    expect(isFieldOutOfView({ top: -30, bottom: 14 }, VISIBLE)).toBe(true)
  })

  it('un campo pegado al borde de abajo cuenta como tapado', () => {
    // Técnicamente entra, pero queda contra el teclado y no se lee al escribir.
    expect(isFieldOutOfView({ top: 376, bottom: 415 }, VISIBLE)).toBe(true)
  })

  it('respeta el margen que se le pida', () => {
    const rect = { top: 100, bottom: 415 }
    expect(isFieldOutOfView(rect, VISIBLE, 0)).toBe(false)
    expect(isFieldOutOfView(rect, VISIBLE, 12)).toBe(true)
  })

  it('con el teclado cerrado, el mismo campo de abajo ya no está tapado', () => {
    expect(isFieldOutOfView({ top: 600, bottom: 644 }, 850)).toBe(false)
  })
})
