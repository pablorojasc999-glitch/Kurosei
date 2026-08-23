import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Installed PWAs tend to stay open for days without a real page reload, so
 * the service worker can silently sit on an old app version — this checks
 * for a newer one periodically and prompts the user to reload when found.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => {
        registration.update()
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-toast">
      <span>Hay una versión nueva de Kurosei disponible.</span>
      <button type="button" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  )
}
