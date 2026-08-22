import { useState } from 'react'
import { ExerciseLibraryPage } from './modules/training/components/ExerciseLibraryPage'
import { PeriodizationPage } from './modules/training/components/PeriodizationPage'
import './App.css'

type Tab = 'library' | 'periodization'

function App() {
  const [tab, setTab] = useState<Tab>('periodization')

  return (
    <div className="app-shell">
      <main className="app-content">
        <div hidden={tab !== 'periodization'}>
          <PeriodizationPage />
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
