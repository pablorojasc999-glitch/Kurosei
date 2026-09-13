import { describe, expect, it } from 'vitest'
import {
  extendRest,
  formatRestClock,
  pauseRest,
  remainingSeconds,
  resumeRest,
  startRest,
} from './restTimer'

/** Un instante cualquiera, para que las cuentas se lean solas. */
const T0 = 1_757_000_000_000
const seg = (n: number) => n * 1000

describe('descanso contado contra el reloj', () => {
  it('arranca con el descanso completo', () => {
    expect(remainingSeconds(startRest(120, T0), T0)).toBe(120)
  })

  it('descuenta lo que pasó de verdad', () => {
    const rest = startRest(120, T0)
    expect(remainingSeconds(rest, T0 + seg(30))).toBe(90)
  })

  it('no se pierde aunque el navegador congele los temporizadores', () => {
    // Pantalla bloqueada tres minutos: no corre ningún tic, pero el reloj sí.
    const rest = startRest(120, T0)
    expect(remainingSeconds(rest, T0 + seg(180))).toBe(-60)
  })

  it('sigue en negativo cuando se pasa, para saber cuánto de más se descansó', () => {
    const rest = startRest(60, T0)
    expect(remainingSeconds(rest, T0 + seg(75))).toBe(-15)
  })
})

describe('pausar y reanudar', () => {
  it('congela lo que quedaba en el momento de pausar', () => {
    const pausado = pauseRest(startRest(120, T0), T0 + seg(30))
    expect(remainingSeconds(pausado, T0 + seg(30))).toBe(90)
    // Diez minutos después sigue marcando lo mismo: para eso es una pausa.
    expect(remainingSeconds(pausado, T0 + seg(630))).toBe(90)
  })

  it('al reanudar sigue desde donde se quedó, no desde donde habría estado', () => {
    const pausado = pauseRest(startRest(120, T0), T0 + seg(30))
    const reanudado = resumeRest(pausado, T0 + seg(600))
    expect(remainingSeconds(reanudado, T0 + seg(600))).toBe(90)
    expect(remainingSeconds(reanudado, T0 + seg(630))).toBe(60)
  })

  it('pausar dos veces no cambia nada', () => {
    const una = pauseRest(startRest(120, T0), T0 + seg(30))
    expect(pauseRest(una, T0 + seg(90))).toBe(una)
  })

  it('reanudar algo que ya corre no lo reinicia', () => {
    const corriendo = startRest(120, T0)
    expect(resumeRest(corriendo, T0 + seg(30))).toBe(corriendo)
  })

  it('se puede pausar un descanso ya pasado y conserva el negativo', () => {
    const pausado = pauseRest(startRest(60, T0), T0 + seg(90))
    expect(remainingSeconds(pausado, T0 + seg(900))).toBe(-30)
  })
})

describe('alargar el descanso', () => {
  it('suma al que está corriendo', () => {
    const rest = extendRest(startRest(120, T0), 15, T0 + seg(30))
    expect(remainingSeconds(rest, T0 + seg(30))).toBe(105)
  })

  it('suma al que está pausado sin reanudarlo', () => {
    const pausado = pauseRest(startRest(120, T0), T0 + seg(30))
    const alargado = extendRest(pausado, 15, T0 + seg(60))
    expect(alargado.status).toBe('paused')
    expect(remainingSeconds(alargado, T0 + seg(600))).toBe(105)
  })

  it('sobre un descanso ya pasado da 15 s de verdad, no recorta la deuda', () => {
    // A los 90 s de un descanso de 60 se deben 30. "+15 s" tiene que dejar 15
    // por delante, no subir de -30 a -15 y seguir en rojo.
    const alargado = extendRest(startRest(60, T0), 15, T0 + seg(90))
    expect(remainingSeconds(alargado, T0 + seg(90))).toBe(15)
  })
})

describe('formatRestClock', () => {
  it('escribe minutos y segundos', () => {
    expect(formatRestClock(125)).toBe('2:05')
    expect(formatRestClock(60)).toBe('1:00')
    expect(formatRestClock(9)).toBe('0:09')
    expect(formatRestClock(0)).toBe('0:00')
  })

  it('marca con + lo que se pasó', () => {
    expect(formatRestClock(-12)).toBe('+0:12')
    expect(formatRestClock(-90)).toBe('+1:30')
  })
})
