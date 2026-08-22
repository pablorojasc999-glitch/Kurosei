import { useState } from 'react'
import { CalendarPage } from './modules/training/components/CalendarPage'
import { ExerciseLibraryPage } from './modules/training/components/ExerciseLibraryPage'
import { PeriodizationPage } from './modules/training/components/PeriodizationPage'
import './App.css'

type Tab = 'library' | 'periodization' | 'calendar'

function App() {
  const [tab, setTab] = useState<Tab>('periodization')
  const [jumpToDayId, setJumpToDayId] = useState<string | null>(null)

  function handleOpenDay(dayId: string) {
    setJumpToDayId(dayId)
    setTab('periodization')
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <div hidden={tab !== 'periodization'}>
          <PeriodizationPage
            jumpToDayId={jumpToDayId}
            onJumpHandled={() => setJumpToDayId(null)}
          />
        </div>
        <div hidden={tab !== 'calendar'}>
          <CalendarPage onOpenDay={handleOpenDay} />
        </div>
        <div hidden={tab !== 'library'}>
          <ExerciseLibraryPage />
        </div>
      </main>
      <nav className="tabs">
        <button
          type="button"
          className={tab === 'periodization' ? 'active' : ''}
          onClick={() => setTab('periodization')}
        >
          Periodización
        </button>
        <button
          type="button"
          className={tab === 'calendar' ? 'active' : ''}
          onClick={() => setTab('calendar')}
        >
          Calendario
        </button>
        <button
          type="button"
          className={tab === 'library' ? 'active' : ''}
          onClick={() => setTab('library')}
        >
          Biblioteca
        </button>
      </nav>
    </div>
  )
}

export default App
