import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import type { AtlasNode, MasteryLevel } from '../domain/types'
import { MASTERY_LEVELS } from '../domain/types'
import {
  createNode,
  createProfile,
  listAllNodes,
  listProfiles,
  reparentNode,
  softDeleteNode,
  softDeleteProfile,
  updateNodeLevel,
  updateNodeName,
  updateNodeNote,
} from '../db/atlasRepository'
import type { AtlasTemplate } from '../lib/atlasTemplates'
import { LEVEL_COLOR, LEVEL_LABEL, countByLevel } from '../lib/atlasTree'
import { AtlasEmptyState } from './AtlasEmptyState'
import { AtlasMap } from './AtlasMap'
import { AtlasNodePage } from './AtlasNodePage'
import { AtlasOverview } from './AtlasOverview'

type AtlasView = 'map' | 'node' | 'overview' | 'new-profile'

export function AtlasPage() {
  const desktop = useMediaQuery('(min-width: 900px)')
  const profiles = useLiveQuery(() => listProfiles(), [])
  const allNodes = useLiveQuery(() => listAllNodes(), [])

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [view, setView] = useState<AtlasView>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openNodeId, setOpenNodeId] = useState<string | null>(null)
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [draftLevel, setDraftLevel] = useState<MasteryLevel>('desarrollo')
  const [armedProfileDelete, setArmedProfileDelete] = useState(false)

  const nodesByProfile = useMemo(() => {
    const map = new Map<string, AtlasNode[]>()
    for (const node of allNodes ?? []) {
      const bucket = map.get(node.profileId)
      if (bucket) bucket.push(node)
      else map.set(node.profileId, [node])
    }
    return map
  }, [allNodes])

  // Todavía cargando de Dexie: no se pinta el estado vacío para no hacer
  // parpadear "Tu mapa está en blanco" en cada entrada a la pestaña.
  if (!profiles || !allNodes) return <div className="atlas" />

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null
  const nodes = activeProfile ? (nodesByProfile.get(activeProfile.id) ?? []) : []
  const openNode = nodes.find((n) => n.id === openNodeId) ?? null
  const counts = countByLevel(nodes)

  async function handleCreateProfile(name: string, template?: AtlasTemplate) {
    const profile = await createProfile(name, template)
    setActiveProfileId(profile.id)
    setSelectedId(null)
    setOpenNodeId(null)
    setDraftParentId(null)
    setView('map')
  }

  async function handleDraftSave(name: string) {
    if (!activeProfile || !draftParentId) return
    const node = await createNode({
      profileId: activeProfile.id,
      parentId: draftParentId,
      name,
      level: draftLevel,
    })
    setDraftParentId(null)
    setDraftLevel('desarrollo')
    setSelectedId(node.id)
  }

  function requestDraft(parentId: string) {
    setDraftParentId(parentId)
    setDraftLevel('desarrollo')
    setView('map')
  }

  async function handleDeleteNode() {
    if (!openNode) return
    const parentId = openNode.parentId
    await softDeleteNode(openNode.id)
    setOpenNodeId(null)
    setSelectedId(parentId)
    setView('map')
  }

  async function handleDeleteProfile() {
    if (!activeProfile) return
    await softDeleteProfile(activeProfile.id)
    setActiveProfileId(null)
    setSelectedId(null)
    setOpenNodeId(null)
    setDraftParentId(null)
    setArmedProfileDelete(false)
    setView('map')
  }

  // Sin ningún perfil no hay nada que enmarcar: el estado vacío ocupa todo.
  if (profiles.length === 0) {
    return (
      <div className="atlas">
        <AtlasEmptyState additional={false} desktop={desktop} onCreate={handleCreateProfile} />
      </div>
    )
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null
  const rootNode = nodes.find((n) => n.parentId === null) ?? null
  const addParentId = selectedNode?.id ?? rootNode?.id ?? null

  return (
    <div className="atlas">
      <div className="atlas-tabs">
        {profiles.map((profile) => {
          const root = (nodesByProfile.get(profile.id) ?? []).find((n) => n.parentId === null)
          const active = profile.id === activeProfile?.id && view !== 'overview'
          return (
            <button
              key={profile.id}
              type="button"
              className={`atlas-tab${active ? ' atlas-tab--active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setActiveProfileId(profile.id)
                setSelectedId(null)
                setOpenNodeId(null)
                setDraftParentId(null)
                setArmedProfileDelete(false)
                setView('map')
              }}
            >
              <span
                className="atlas-tab-dot"
                style={{ background: LEVEL_COLOR[root?.level ?? 'desarrollo'] }}
              />
              {profile.name}
            </button>
          )
        })}
        <button
          type="button"
          className="atlas-tab-add"
          aria-label="Añadir perfil"
          onClick={() => setView('new-profile')}
        >
          +
        </button>
        <span className="atlas-tabs-spacer" />
        <div className="atlas-tabs-actions">
          <button type="button" onClick={() => setView('overview')}>
            PANORÁMICA
          </button>
          {desktop && view !== 'overview' && view !== 'new-profile' && (
            <button
              type="button"
              style={armedProfileDelete ? { color: 'var(--atlas-rojo)' } : undefined}
              onClick={() => {
                if (armedProfileDelete) void handleDeleteProfile()
                else setArmedProfileDelete(true)
              }}
              onBlur={() => setArmedProfileDelete(false)}
            >
              {armedProfileDelete ? 'PULSA OTRA VEZ' : 'BORRAR PERFIL'}
            </button>
          )}
        </div>
      </div>

      {view === 'new-profile' && (
        <AtlasEmptyState
          additional
          desktop={desktop}
          onCreate={handleCreateProfile}
          onCancel={() => setView('map')}
        />
      )}

      {view === 'overview' && (
        <AtlasOverview
          profiles={profiles}
          nodesByProfile={nodesByProfile}
          onOpenProfile={(id) => {
            setActiveProfileId(id)
            setSelectedId(null)
            setOpenNodeId(null)
            setView('map')
          }}
          onAddProfile={() => setView('new-profile')}
        />
      )}

      {view === 'node' && openNode && activeProfile && (
        <AtlasNodePage
          key={openNode.id}
          profileName={activeProfile.name}
          node={openNode}
          parent={nodes.find((n) => n.id === openNode.parentId) ?? null}
          childNodes={nodes
            .filter((n) => n.parentId === openNode.id)
            .sort((a, b) => a.order - b.order)}
          desktop={desktop}
          onBack={() => setView('map')}
          onOpen={(id) => setOpenNodeId(id)}
          onRename={(name) => void updateNodeName(openNode.id, name)}
          onLevel={(level) => void updateNodeLevel(openNode.id, level)}
          onNote={(note) => void updateNodeNote(openNode.id, note)}
          onAddChild={() => requestDraft(openNode.id)}
          onDelete={() => void handleDeleteNode()}
        />
      )}

      {(view === 'map' || (view === 'node' && !openNode)) && activeProfile && (
        <>
          <AtlasMap
            profileName={activeProfile.name}
            nodes={nodes}
            desktop={desktop}
            selectedId={selectedId}
            draftParentId={draftParentId}
            draftLevel={draftLevel}
            onSelect={setSelectedId}
            onOpen={(id) => {
              setOpenNodeId(id)
              setView('node')
            }}
            onRequestDraft={requestDraft}
            onDraftLevel={setDraftLevel}
            onDraftSave={(name) => void handleDraftSave(name)}
            onDraftCancel={() => setDraftParentId(null)}
            onReparent={(nodeId, newParentId) => void reparentNode(nodeId, newParentId)}
          />

          {desktop ? (
            <div className="atlas-statusbar">
              <span>
                {nodes.length} NODO{nodes.length === 1 ? '' : 'S'}
              </span>
              <div className="atlas-balance">
                {MASTERY_LEVELS.map((level) =>
                  counts[level] > 0 ? (
                    <span
                      key={level}
                      style={{ flex: counts[level], background: LEVEL_COLOR[level] }}
                    />
                  ) : null,
                )}
              </div>
              <span className="atlas-tabs-spacer" />
              <span>CLIC PARA SELECCIONAR · ↵ PARA ABRIR · MANTÉN PARA MOVER</span>
            </div>
          ) : (
            <div className="atlas-actionbar">
              {selectedNode ? (
                <button
                  type="button"
                  className="atlas-actionbar-main"
                  onClick={() => {
                    setOpenNodeId(selectedNode.id)
                    setView('node')
                  }}
                >
                  <span className="atlas-actionbar-label">
                    SELECCIONADO · {LEVEL_LABEL[selectedNode.level].toUpperCase()}
                  </span>
                  <span className="atlas-relation-name">{selectedNode.name} ›</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="atlas-actionbar-text"
                  onClick={() => setView('overview')}
                >
                  TOCA UN NODO
                </button>
              )}
              <button
                type="button"
                className="atlas-actionbar-add"
                aria-label={
                  selectedNode
                    ? `Añadir un nodo bajo ${selectedNode.name}`
                    : 'Añadir un nodo bajo la raíz'
                }
                disabled={!addParentId}
                onClick={() => addParentId && requestDraft(addParentId)}
              >
                +
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
