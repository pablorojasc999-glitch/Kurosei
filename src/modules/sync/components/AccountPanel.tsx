import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../../../shared/supabase/client'
import { getSession, onAuthStateChange, signInWithEmail, signOut, signUpWithEmail } from '../lib/auth'
import { getSyncStatus, subscribeSyncStatus, syncNow, type SyncStatus } from '../lib/syncEngine'

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000

function IconAccount() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="account-icon"
      aria-hidden
    >
      <circle cx={12} cy={8} r={4} />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(deltaMs / 60000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function syncStatusText(status: SyncStatus): string {
  if (status.kind === 'syncing') return 'Sincronizando…'
  if (status.kind === 'error') return `Error al sincronizar: ${status.message}`
  if (status.lastSyncedAt) return `Sincronizado ${formatRelativeTime(status.lastSyncedAt)}`
  return 'Todavía no sincronizaste'
}

export function AccountPanel() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus())

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getSession().then((s) => {
      setSession(s)
      setSessionLoaded(true)
    })
    return onAuthStateChange((s) => setSession(s))
  }, [])

  useEffect(() => subscribeSyncStatus(setSyncStatus), [])

  useEffect(() => {
    if (!session) return
    syncNow(session.user.id).catch(() => {})
    const interval = window.setInterval(() => {
      syncNow(session.user.id).catch(() => {})
    }, AUTO_SYNC_INTERVAL_MS)
    const handleOnline = () => {
      syncNow(session.user.id).catch(() => {})
    }
    window.addEventListener('online', handleOnline)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', handleOnline)
    }
  }, [session])

  if (!isSupabaseConfigured) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      if (mode === 'signUp') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
      setEmail('')
      setPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    }
    setSubmitting(false)
  }

  return (
    <div className="account-panel-wrapper">
      <button
        type="button"
        className="account-button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta y sincronización"
      >
        <IconAccount />
      </button>

      {open && (
        <div className="account-panel">
          {!sessionLoaded ? null : session ? (
            <>
              <p className="account-email">{session.user.email}</p>
              <p className="account-sync-status">{syncStatusText(syncStatus)}</p>
              <button
                type="button"
                onClick={() => syncNow(session.user.id).catch(() => {})}
                disabled={syncStatus.kind === 'syncing'}
              >
                Sincronizar ahora
              </button>
              <button
                type="button"
                className="account-signout"
                onClick={() => signOut()}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="account-form">
              <div className="account-mode-toggle">
                <button
                  type="button"
                  className={mode === 'signIn' ? 'active' : ''}
                  onClick={() => setMode('signIn')}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={mode === 'signUp' ? 'active' : ''}
                  onClick={() => setMode('signUp')}
                >
                  Crear cuenta
                </button>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
              {formError && <p className="error">{formError}</p>}
              <button type="submit" disabled={submitting}>
                {mode === 'signUp' ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
