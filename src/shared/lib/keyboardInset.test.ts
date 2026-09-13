import { describe, expect, it } from 'vitest'
import { keyboardInset } from './keyboardInset'

describe('keyboardInset', () => {
  it('mide lo que el teclado tapa por abajo', () => {
    expect(keyboardInset(850, { height: 500, offsetTop: 0 })).toBe(350)
  })

  it('sin teclado no tapa nada', () => {
    expect(keyboardInset(850, { height: 850, offsetTop: 0 })).toBe(0)
  })

  it('descuenta lo que la página está desplazada al estar ampliada', () => {
    // El viewport visible empieza 100 px más abajo: el teclado tapa 250, no 350.
    expect(keyboardInset(850, { height: 500, offsetTop: 100 })).toBe(250)
  })

  it('ignora diferencias mínimas, que son la barra del navegador y no un teclado', () => {
    expect(keyboardInset(850, { height: 840, offsetTop: 0 })).toBe(0)
  })

  it('no devuelve negativos cuando el viewport visible es más alto que la página', () => {
    expect(keyboardInset(500, { height: 850, offsetTop: 0 })).toBe(0)
  })

  it('sin visualViewport se queda en cero', () => {
    expect(keyboardInset(850, null)).toBe(0)
  })
})
