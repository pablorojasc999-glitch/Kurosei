import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { buildIndex, parseLinks } from '../lib/atlasLinks'
import {
  createNote,
  findByTitle,
  getNote,
  listNotes,
  openOrCreateByTitle,
  setLevel,
  softDeleteNote,
  updateNote,
} from './atlasRepository'

beforeEach(async () => {
  await db.atlas_notes.clear()
})

describe('crear notas', () => {
  it('crea con nivel «desarrollo» y cuerpo vacío por defecto', async () => {
    const note = await createNote({ title: 'Sentadilla' })
    expect(note).toMatchObject({ title: 'Sentadilla', body: '', level: 'desarrollo' })
    expect(await getNote(note.id)).toMatchObject({ title: 'Sentadilla' })
  })

  it('recorta el título y rechaza el vacío', async () => {
    const note = await createNote({ title: '  Peso muerto  ' })
    expect(note.title).toBe('Peso muerto')
    await expect(createNote({ title: '   ' })).rejects.toThrow(/título/)
  })

  it('rechaza un título repetido, aunque cambie de mayúsculas o acentos', async () => {
    await createNote({ title: 'Técnica' })
    await expect(createNote({ title: 'tecnica' })).rejects.toThrow(/Ya existe/)
    expect(await listNotes()).toHaveLength(1)
  })

  it('ordena la lista alfabéticamente y deja fuera las borradas', async () => {
    await createNote({ title: 'Zancada' })
    const banco = await createNote({ title: 'Banco' })
    await createNote({ title: 'Press' })
    await softDeleteNote(banco.id)
    expect((await listNotes()).map((n) => n.title)).toEqual(['Press', 'Zancada'])
  })
})

describe('abrir por título', () => {
  it('crea la nota la primera vez y devuelve la misma después', async () => {
    const first = await openOrCreateByTitle('Bloque 1')
    const second = await openOrCreateByTitle('bloque 1')
    expect(second.id).toBe(first.id)
    expect(await listNotes()).toHaveLength(1)
  })
})

describe('renombrar', () => {
  it('reescribe los [[enlaces]] de las demás notas', async () => {
    const tecnica = await createNote({ title: 'Técnica' })
    await createNote({ title: 'Sentadilla', body: 'Ver [[Técnica]] y [[Cadera]].' })
    await createNote({ title: 'Press', body: 'Nada que ver aquí.' })

    await updateNote(tecnica.id, { title: 'Técnica de barra' })

    const sentadilla = await findByTitle('Sentadilla')
    expect(sentadilla?.body).toBe('Ver [[Técnica de barra]] y [[Cadera]].')
    expect((await findByTitle('Press'))?.body).toBe('Nada que ver aquí.')
  })

  it('conserva el alias al reescribir', async () => {
    const nota = await createNote({ title: 'Cadera' })
    await createNote({ title: 'Bisagra', body: 'La [[Cadera|bisagra de cadera]] manda.' })
    await updateNote(nota.id, { title: 'Cadera y glúteo' })
    expect((await findByTitle('Bisagra'))?.body).toBe(
      'La [[Cadera y glúteo|bisagra de cadera]] manda.',
    )
  })

  it('no deja enlaces rotos tras el renombrado', async () => {
    const hijo = await createNote({ title: 'Hijo' })
    await createNote({ title: 'Padre', body: '- [[Hijo]]' })
    await updateNote(hijo.id, { title: 'Hija' })
    const index = buildIndex(await listNotes())
    expect([...index.broken.values()].flat()).toEqual([])
  })

  it('cambiar sólo mayúsculas no toca el cuerpo de las demás', async () => {
    const nota = await createNote({ title: 'Rpe' })
    await createNote({ title: 'Escala', body: 'Mide con [[Rpe]].' })
    await updateNote(nota.id, { title: 'RPE' })
    // El enlace ya resolvía sin distinguir mayúsculas: reescribirlo sería ruido.
    expect((await findByTitle('Escala'))?.body).toBe('Mide con [[Rpe]].')
    expect((await findByTitle('rpe'))?.title).toBe('RPE')
  })

  it('rechaza renombrar a un título que ya existe', async () => {
    await createNote({ title: 'Banco' })
    const press = await createNote({ title: 'Press' })
    await expect(updateNote(press.id, { title: 'banco' })).rejects.toThrow(/Ya existe/)
    expect((await getNote(press.id))?.title).toBe('Press')
  })

  it('deja renombrar la nota a su mismo título', async () => {
    const nota = await createNote({ title: 'Sentadilla' })
    await expect(updateNote(nota.id, { title: 'Sentadilla ' })).resolves.toBeUndefined()
    expect((await getNote(nota.id))?.title).toBe('Sentadilla')
  })
})

describe('cuerpo y nivel', () => {
  it('guarda el cuerpo y avanza updatedAt', async () => {
    const nota = await createNote({ title: 'Diario' })
    await updateNote(nota.id, { body: 'Hoy toca [[Sentadilla]] #fuerza' })
    const saved = await getNote(nota.id)
    expect(parseLinks(saved?.body ?? '').map((l) => l.target)).toEqual(['Sentadilla'])
    expect(saved?.updatedAt).not.toBe('')
  })

  it('cambia el nivel de dominio', async () => {
    const nota = await createNote({ title: 'Arranque' })
    await setLevel(nota.id, 'principiante')
    expect((await getNote(nota.id))?.level).toBe('principiante')
  })
})

describe('borrar', () => {
  it('deja los enlaces entrantes escritos, ahora rotos', async () => {
    const hijo = await createNote({ title: 'Hijo' })
    await createNote({ title: 'Padre', body: '- [[Hijo]]' })
    await softDeleteNote(hijo.id)

    const padre = await findByTitle('Padre')
    expect(padre?.body).toBe('- [[Hijo]]')
    const index = buildIndex(await listNotes())
    expect([...index.broken.values()].flat().map((l) => l.target)).toEqual(['Hijo'])
  })

  it('libera el título para una nota nueva', async () => {
    const nota = await createNote({ title: 'Sentadilla' })
    await softDeleteNote(nota.id)
    const nueva = await createNote({ title: 'Sentadilla' })
    expect(nueva.id).not.toBe(nota.id)
  })
})
