import { useState } from 'react'
import { CalendarPage } from './modules/training/components/CalendarPage'
import { ExerciseLibraryPage } from './modules/training/components/ExerciseLibraryPage'
import { PeriodizationPage } from './modules/training/components/PeriodizationPage'
import { ProgressPage } from './modules/training/components/ProgressPage'
import { RegistroPage } from './modules/training/components/RegistroPage'
import './App.css'

type Tab = 'registro' | 'periodizacion' | 'calendario' | 'progreso' | 'biblioteca'

function App() {
  const [tab, setTab] = useState<Tab>('registro')
  const [jumpToDate, setJumpToDate] = useState<Date | null>(null)
  const [jumpToDayId, setJumpToDayId] = useState<string | null>(null)

  function handleOpenDay(date: Date) {
    setJumpToDate(date)
    setTab('registro')
  }

  function handleEditPlan(dayId: string) {
    setJumpToDayId(dayId)
    setTab('periodizacion')
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <div hidden={tab !== 'registro'}>
          <RegistroPage jumpToDate={jumpToDate} onEditPlan={handleEditPlan} />
        </div>
        <div hidden={tab !== 'periodizacion'}>
          <PeriodizationPage
            jumpToDayId={jumpToDayId}
            onJumpHandled={() => setJumpToDayId(null)}
          />
        </div>
        <div hidden={tab !== 'calendario'}>
          <CalendarPage onOpenDay={handleOpenDay} />
        </div>
        <div hidden={tab !== 'progreso'}>
          <ProgressPage />
        </div>
        <div hidden={tab !== 'biblioteca'}>
          <ExerciseLibraryPage />
        </div>
      </main>
      <nav className="tabs">
        <button
          type="button"
          className={tab === 'registro' ? 'active' : ''}
          onClick={() => setTab('registro')}
        >
          Registro
        </button>
        <button
          type="button"
          className={tab === 'periodizacion' ? 'active' : ''}
          onClick={() => setTab('periodizacion')}
        >
          Plan
        </button>
        <button
          type="button"
          className={tab === 'calendario' ? 'active' : ''}
          onClick={() => setTab('calendario')}
        >
          Calendario
        </button>
        <button
          type="button"
          className={tab === 'progreso' ? 'active' : ''}
          onClick={() => setTab('progreso')}
        >
          Progreso
        </button>
        <button
          type="button"
          className={tab === 'biblioteca' ? 'active' : ''}
          onClick={() => setTab('biblioteca')}
        >
          Biblioteca
        </button>
      </nav>
    </div>
  )
}

export default App
