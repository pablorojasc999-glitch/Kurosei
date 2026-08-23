import { useState } from 'react'
import { CategoryManager } from './CategoryManager'
import { TimeBlockingPage } from './TimeBlockingPage'

type OrgTab = 'planificador' | 'categorias'

export function OrganizationPage() {
  const [tab, setTab] = useState<OrgTab>('planificador')

  return (
    <div className="page">
      <h1>Organización</h1>

      <div className="sub-tabs">
        <button
          type="button"
          className={tab === 'planificador' ? 'active' : ''}
          onClick={() => setTab('planificador')}
        >
          Planificador
        </button>
        <button
          type="button"
          className={tab === 'categorias' ? 'active' : ''}
          onClick={() => setTab('categorias')}
        >
          Categorías
        </button>
      </div>

      <div hidden={tab !== 'planificador'}>
        <TimeBlockingPage />
      </div>
      <div hidden={tab !== 'categorias'}>
        <CategoryManager />
      </div>
    </div>
  )
}
