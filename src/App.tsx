import { useState } from 'react'
import { CalendarPage } from './modules/training/components/CalendarPage'
import { ExerciseLibraryPage } from './modules/training/components/ExerciseLibraryPage'
import { PeriodizationPage } from './modules/training/components/PeriodizationPage'
import { TodayPage } from './modules/training/components/TodayPage'
import './App.css'

type Tab = 'today' | 'library' | 'periodization' | 'calendar'

function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [jumpToDayId, setJumpToDayId] = useState<string | null>(null)
  const [jumpToView, setJumpToView] = useState<'plan' | 'session'>('session')

  function handleOpenDay(dayId: string, view: 'plan' | 'session' = 'session') {
    setJumpToDayId(dayId)
    setJumpToView(view)
    setTab('periodization')
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <div hidden={tab !== 'today'}>
          <TodayPage onEditPlan={(dayId) => handleOpenDay(dayId, 'plan')} />
        </div>
        <div hidden={tab !== 'periodization'}>
          <PeriodizationPage
            jumpToDayId={jumpToDayId}
            jumpToView={jumpToView}
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
          className={tab === 'today' ? 'active' : ''}
          onClick={() => setTab('today')}
        >
          Hoy
        </button>
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
