import { useState } from 'react'
import { CategoriasPage } from './modules/finance/components/CategoriasPage'
import { CuentasPage } from './modules/finance/components/CuentasPage'
import { EstadisticasPage } from './modules/finance/components/EstadisticasPage'
import {
  IconAccounts,
  IconCategories,
  IconStatistics,
  IconTransactions,
} from './modules/finance/components/icons'
import { TransaccionesPage } from './modules/finance/components/TransaccionesPage'
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

type FinanceTab = 'cuentas' | 'categorias' | 'transacciones' | 'estadisticas'

function App() {
  const [appModule, setAppModule] = useState<AppModule>('entrenamiento')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('registro')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('cuentas')
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
        {appModule === 'finanzas' ? (
          <>
            <div hidden={financeTab !== 'cuentas'}>
              <CuentasPage />
            </div>
            <div hidden={financeTab !== 'categorias'}>
              <CategoriasPage />
            </div>
            <div hidden={financeTab !== 'transacciones'}>
              <TransaccionesPage />
            </div>
            <div hidden={financeTab !== 'estadisticas'}>
              <EstadisticasPage />
            </div>
          </>
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
      {appModule === 'finanzas' ? (
        <nav className="tabs">
          <button
            type="button"
            className={financeTab === 'cuentas' ? 'active' : ''}
            onClick={() => setFinanceTab('cuentas')}
          >
            <IconAccounts />
            Cuentas
          </button>
          <button
            type="button"
            className={financeTab === 'categorias' ? 'active' : ''}
            onClick={() => setFinanceTab('categorias')}
          >
            <IconCategories />
            Categorías
          </button>
          <button
            type="button"
            className={financeTab === 'transacciones' ? 'active' : ''}
            onClick={() => setFinanceTab('transacciones')}
          >
            <IconTransactions />
            Transacciones
          </button>
          <button
            type="button"
            className={financeTab === 'estadisticas' ? 'active' : ''}
            onClick={() => setFinanceTab('estadisticas')}
          >
            <IconStatistics />
            Estadísticas
          </button>
        </nav>
      ) : (
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
