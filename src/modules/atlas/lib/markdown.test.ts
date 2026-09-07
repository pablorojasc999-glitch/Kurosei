import { describe, expect, it } from 'vitest'
import { excerpt, renderMarkdown } from './markdown'

const options = { existingTitles: new Set(['sentadilla']) }

describe('renderMarkdown', () => {
  it('convierte el Markdown de siempre', () => {
    const html = renderMarkdown('# Título\n\nTexto en **negrita**.', options)
    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<strong>negrita</strong>')
  })

  it('un enlace a una nota que existe se marca distinto del que no', () => {
    const html = renderMarkdown('[[Sentadilla]] y [[No existe]]', options)
    expect(html).toContain('data-wikilink="Sentadilla"')
    expect(html).toMatch(/class="md-wikilink"[^>]*data-wikilink="Sentadilla"/)
    expect(html).toContain('md-wikilink--broken')
  })

  it('el alias se pinta pero el destino sigue siendo el título', () => {
    const html = renderMarkdown('[[Sentadilla|la sentadilla]]', options)
    expect(html).toContain('data-wikilink="Sentadilla"')
    expect(html).toContain('>la sentadilla</a>')
  })

  it('las etiquetas quedan pinchables y los encabezados no', () => {
    const html = renderMarkdown('# Encabezado\n\nsobre #fuerza', options)
    expect(html).toContain('data-tag="fuerza"')
    expect(html).toContain('<h1>Encabezado</h1>')
    expect(html).not.toContain('data-tag="Encabezado"')
  })

  it('no ejecuta HTML pegado desde fuera', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> <script>alert(2)</script>', options)
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })

  it('escapa las comillas de un título, que si no romperían el atributo', () => {
    const html = renderMarkdown('[[Nota "rara"]]', options)
    expect(html).toContain('data-wikilink="Nota &quot;rara&quot;"')
  })

  it('respeta listas de tareas y bloques de código', () => {
    const html = renderMarkdown('- [ ] pendiente\n- [x] hecho\n\n```\ncode\n```', options)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('<code>')
  })
})

describe('excerpt', () => {
  it('deja texto plano legible', () => {
    expect(excerpt('# Título\n\nVer [[Sentadilla]] y **esto**.')).toBe(
      'Título Ver Sentadilla y esto.',
    )
  })

  it('usa el alias del enlace cuando lo hay', () => {
    expect(excerpt('Ver [[Movilidad de tobillo|el tobillo]].')).toBe('Ver el tobillo.')
  })

  it('corta por longitud sin partir de golpe', () => {
    const salida = excerpt('palabra '.repeat(40), 30)
    expect(salida.length).toBeLessThanOrEqual(31)
    expect(salida.endsWith('…')).toBe(true)
  })
})
