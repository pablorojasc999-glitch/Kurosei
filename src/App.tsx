import { useState } from 'react'
import { OrganizationPage } from './modules/organization/components/OrganizationPage'
import { CalendarPage } from './modules/training/components/CalendarPage'
import { E1rmCalculatorPage } from './modules/training/components/E1rmCalculatorPage'
import { ExerciseLibraryPage } from './modules/training/components/ExerciseLibraryPage'
import {
  IconCalculator,
  IconCalendar,
  IconLibrary,
  IconPlan,
  IconProgress,
  IconRegistro,
} from './modules/training/components/icons'
import { Logo } from './modules/training/components/Logo'
import { PeriodizationPage } from './modules/training/components/PeriodizationPage'
import { ProgressPage } from './modules/training/components/ProgressPage'
import { RegistroPage } from './modules/training/components/RegistroPage'
import { ReloadPrompt } from './modules/training/components/ReloadPrompt'
import { AccountPanel } from './modules/sync/components/AccountPanel'
import { AppSidebar, type AppModule } from './shared/components/AppSidebar'
import './App.css'

type Tab =
  | 'registro'
  | 'periodizacion'
  | 'calendario'
  | 'progreso'
  | 'biblioteca'
  | 'calculadora'

function App() {
  const [appModule, setAppModule] = useState<AppModule>('entrenamiento')
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
      <ReloadPrompt />
      <AppSidebar
        open={sidebarOpen}
        activeModule={appModule}
        onSelect={setAppModule}
        onClose={() => setSidebarOpen(false)}
      />
      <header className="app-header">
        <div className="app-header-inner">
          <Logo onClick={() => setSidebarOpen(true)} />
          <AccountPanel />
        </div>
      </header>
      <main className="app-content">
        {appModule === 'organizacion' ? (
          <OrganizationPage />
        ) : (
          <>
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
            <div hidden={tab !== 'calculadora'}>
              <E1rmCalculatorPage />
            </div>
          </>
        )}
      </main>
      {appModule === 'entrenamiento' && (
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'registro' ? 'active' : ''}
            onClick={() => setTab('registro')}
          >
            <IconRegistro />
            Registro
          </button>
          <button
            type="button"
            className={tab === 'periodizacion' ? 'active' : ''}
            onClick={() => setTab('periodizacion')}
          >
            <IconPlan />
            Plan
          </button>
          <button
            type="button"
            className={tab === 'calendario' ? 'active' : ''}
            onClick={() => setTab('calendario')}
          >
            <IconCalendar />
            Calendario
          </button>
          <button
            type="button"
            className={tab === 'progreso' ? 'active' : ''}
            onClick={() => setTab('progreso')}
          >
            <IconProgress />
            Progreso
          </button>
          <button
            type="button"
            className={tab === 'biblioteca' ? 'active' : ''}
            onClick={() => setTab('biblioteca')}
          >
            <IconLibrary />
            Biblioteca
          </button>
          <button
            type="button"
            className={tab === 'calculadora' ? 'active' : ''}
            onClick={() => setTab('calculadora')}
          >
            <IconCalculator />
            Calc.
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
