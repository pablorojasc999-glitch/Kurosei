import { useCallback, useState } from 'react'
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
import { IconGrocery } from './modules/grocery/components/icons'
import { SupermercadoPage } from './modules/grocery/components/SupermercadoPage'
import { AguaPage } from './modules/nutrition/components/AguaPage'
import { BibliotecaPage as NutritionBibliotecaPage } from './modules/nutrition/components/BibliotecaPage'
import {
  IconFoodLibrary,
  IconGoals,
  IconNutritionRegistro,
  IconTemplates,
  IconWater,
} from './modules/nutrition/components/icons'
import { MetasPage } from './modules/nutrition/components/MetasPage'
import { PlantillasPage } from './modules/nutrition/components/PlantillasPage'
import { RegistroPage as NutritionRegistroPage } from './modules/nutrition/components/RegistroPage'
import { CalendarioPage } from './modules/closing/components/CalendarioPage'
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
import { getPreferences, type HomeTab } from './modules/sync/db/preferencesRepository'
import { AppSidebar, type AppModule } from './shared/components/AppSidebar'
import { useRemoteQuery } from './shared/hooks/useRemoteQuery'
import './App.css'

type Tab = 'periodizacion' | 'calendario' | 'progreso' | 'biblioteca' | 'calculadora'

type FinanceTab = 'cuentas' | 'categorias' | 'estadisticas'

type NutritionTab = 'plantillas' | 'agua' | 'biblioteca' | 'metas'

/** Las mismas cinco pestañas que puede ser "pantalla de inicio" — ver `preferencesRepository`. */
type RegistroTab = HomeTab

function App() {
  const [appModule, setAppModule] = useState<AppModule>('registro')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Constancia es el valor por omisión: lo primero que conviene ver al abrir
  // la app es qué días quedaron a medias. Cada cuenta puede cambiarlo desde
  // el panel de cuenta (ver `preferencesRepository`) — se aplica una sola
  // vez, apenas se sabe cuál es, y nunca si la persona ya navegó a otra
  // pestaña mientras tanto (`navigated` corta eso).
  const [registroTab, setRegistroTab] = useState<RegistroTab>('constancia')
  const [tab, setTab] = useState<Tab>('periodizacion')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('cuentas')
  const [nutritionTab, setNutritionTab] = useState<NutritionTab>('plantillas')
  const [jumpToDate, setJumpToDate] = useState<Date | null>(null)
  const [jumpToDayId, setJumpToDayId] = useState<string | null>(null)

  const { data: preferences } = useRemoteQuery(useCallback(() => getPreferences(), []))
  const [navigated, setNavigated] = useState(false)
  // Ajusta `registroTab` en el render, no en un efecto: así no hace falta
  // esperar un ciclo extra para que se vea, y React ya sabe tratar esto como
  // "ajustar estado cuando cambia un dato" en vez de un efecto secundario.
  const [homeTabApplied, setHomeTabApplied] = useState(false)
  if (!homeTabApplied && !navigated && preferences !== undefined) {
    setHomeTabApplied(true)
    if (preferences) setRegistroTab(preferences.homeTab)
  }

  function selectRegistroTab(nextTab: RegistroTab) {
    setNavigated(true)
    setRegistroTab(nextTab)
  }

  function handleOpenDay(date: Date) {
    setNavigated(true)
    setJumpToDate(date)
    setAppModule('registro')
    setRegistroTab('entrenamiento')
  }

  function handleEditPlan(dayId: string) {
    setJumpToDayId(dayId)
    setAppModule('entrenamiento')
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
        {appModule === 'registro' ? (
          <>
            <div hidden={registroTab !== 'constancia'}>
              <CalendarioPage onOpenDay={handleOpenDay} />
            </div>
            <div hidden={registroTab !== 'entrenamiento'}>
              <RegistroPage jumpToDate={jumpToDate} onEditPlan={handleEditPlan} />
            </div>
            <div hidden={registroTab !== 'nutricion'}>
              <NutritionRegistroPage />
            </div>
            <div hidden={registroTab !== 'finanzas'}>
              <TransaccionesPage />
            </div>
            <div hidden={registroTab !== 'supermercado'}>
              <SupermercadoPage />
            </div>
          </>
        ) : appModule === 'finanzas' ? (
          <>
            <div hidden={financeTab !== 'cuentas'}>
              <CuentasPage />
            </div>
            <div hidden={financeTab !== 'categorias'}>
              <CategoriasPage />
            </div>
            <div hidden={financeTab !== 'estadisticas'}>
              <EstadisticasPage />
            </div>
          </>
        ) : appModule === 'nutricion' ? (
          <>
            <div hidden={nutritionTab !== 'plantillas'}>
              <PlantillasPage />
            </div>
            <div hidden={nutritionTab !== 'agua'}>
              <AguaPage />
            </div>
            <div hidden={nutritionTab !== 'biblioteca'}>
              <NutritionBibliotecaPage />
            </div>
            <div hidden={nutritionTab !== 'metas'}>
              <MetasPage />
            </div>
          </>
        ) : (
          <>
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
      {appModule === 'registro' ? (
        <nav className="tabs">
          <button
            type="button"
            className={registroTab === 'constancia' ? 'active' : ''}
            onClick={() => selectRegistroTab('constancia')}
          >
            <IconCalendar />
            Constancia
          </button>
          <button
            type="button"
            className={registroTab === 'entrenamiento' ? 'active' : ''}
            onClick={() => selectRegistroTab('entrenamiento')}
          >
            <IconRegistro />
            Entreno
          </button>
          <button
            type="button"
            className={registroTab === 'nutricion' ? 'active' : ''}
            onClick={() => selectRegistroTab('nutricion')}
          >
            <IconNutritionRegistro />
            Nutrición
          </button>
          <button
            type="button"
            className={registroTab === 'finanzas' ? 'active' : ''}
            onClick={() => selectRegistroTab('finanzas')}
          >
            <IconTransactions />
            Finanzas
          </button>
          <button
            type="button"
            className={registroTab === 'supermercado' ? 'active' : ''}
            onClick={() => selectRegistroTab('supermercado')}
          >
            <IconGrocery />
            Súper
          </button>
        </nav>
      ) : appModule === 'finanzas' ? (
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
            className={financeTab === 'estadisticas' ? 'active' : ''}
            onClick={() => setFinanceTab('estadisticas')}
          >
            <IconStatistics />
            Estadísticas
          </button>
        </nav>
      ) : appModule === 'nutricion' ? (
        <nav className="tabs">
          <button
            type="button"
            className={nutritionTab === 'plantillas' ? 'active' : ''}
            onClick={() => setNutritionTab('plantillas')}
          >
            <IconTemplates />
            Plantillas
          </button>
          <button
            type="button"
            className={nutritionTab === 'agua' ? 'active' : ''}
            onClick={() => setNutritionTab('agua')}
          >
            <IconWater />
            Agua
          </button>
          <button
            type="button"
            className={nutritionTab === 'biblioteca' ? 'active' : ''}
            onClick={() => setNutritionTab('biblioteca')}
          >
            <IconFoodLibrary />
            Biblioteca
          </button>
          <button
            type="button"
            className={nutritionTab === 'metas' ? 'active' : ''}
            onClick={() => setNutritionTab('metas')}
          >
            <IconGoals />
            Metas
          </button>
        </nav>
      ) : (
        <nav className="tabs">
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
