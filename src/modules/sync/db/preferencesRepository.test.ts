import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseClient } from '../../../shared/supabase/testing'

const fake = createFakeSupabaseClient()

vi.mock('../../../shared/supabase/client', () => ({
  supabase: fake.client,
  isSupabaseConfigured: true,
}))

vi.mock('../lib/auth', () => ({
  requireUserId: async () => 'user-1',
}))

const { getPreferences, setHomeTab } = await import('./preferencesRepository')

beforeEach(() => {
  fake.tables.app_preferences = []
})

describe('getPreferences / setHomeTab', () => {
  it('sin fila guardada todavía, no hay preferencia', async () => {
    expect(await getPreferences()).toBeNull()
  })

  it('crea la fila en el primer guardado', async () => {
    const saved = await setHomeTab('entrenamiento')
    expect(saved.homeTab).toBe('entrenamiento')
    expect(await getPreferences()).toMatchObject({ id: saved.id, homeTab: 'entrenamiento' })
  })

  it('edita la misma fila en los siguientes guardados, sin crear una segunda', async () => {
    const first = await setHomeTab('entrenamiento')
    const second = await setHomeTab('nutricion')

    expect(second.id).toBe(first.id)
    expect(fake.tables.app_preferences.filter((p) => p.deletedAt === null)).toHaveLength(1)
    expect(await getPreferences()).toMatchObject({ homeTab: 'nutricion' })
  })
})
