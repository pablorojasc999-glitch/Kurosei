import { BODY_REGION_LABELS } from '../lib/bodyMap'
import type { BodyRegionKey } from '../lib/bodyMap'

interface BodyMapProps {
  valuesByRegion: Partial<Record<BodyRegionKey, number>>
  maxValue: number
}

function regionStyle(value: number | undefined, maxValue: number) {
  if (!value) {
    return { fill: 'var(--surface-2)' }
  }
  const intensity = Math.min(1, value / maxValue)
  return {
    fill: 'var(--accent)',
    fillOpacity: 0.35 + intensity * 0.55,
  }
}

interface RegionProps {
  region: BodyRegionKey
  value: number | undefined
  maxValue: number
  d?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rx?: number
  cx?: number
  cy?: number
  r?: number
}

function Region(props: RegionProps) {
  const { region, value, maxValue } = props
  const style = regionStyle(value, maxValue)
  const title = `${BODY_REGION_LABELS[region]}: ${value ? value.toFixed(1) : 'sin datos'}`

  if (props.cx !== undefined) {
    return (
      <circle cx={props.cx} cy={props.cy} r={props.r} style={style} className="body-map-region">
        <title>{title}</title>
      </circle>
    )
  }
  return (
    <rect
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      rx={props.rx}
      style={style}
      className="body-map-region"
    >
      <title>{title}</title>
    </rect>
  )
}

export function BodyMap({ valuesByRegion, maxValue }: BodyMapProps) {
  const v = (region: BodyRegionKey) => valuesByRegion[region]

  return (
    <div className="body-map">
      <div className="body-map-figure">
        <svg viewBox="0 0 100 190" className="body-map-svg">
          <circle cx={50} cy={14} r={11} className="body-map-neutral" />
          <rect x={44} y={22} width={12} height={8} className="body-map-neutral" />
          <Region region="pecho" value={v('pecho')} maxValue={maxValue} x={31} y={34} width={38} height={26} rx={8} />
          <Region region="hombro" value={v('hombro')} maxValue={maxValue} cx={27} cy={38} r={10} />
          <Region region="hombro" value={v('hombro')} maxValue={maxValue} cx={73} cy={38} r={10} />
          <Region region="abdomen" value={v('abdomen')} maxValue={maxValue} x={36} y={61} width={28} height={26} rx={6} />
          <Region region="biceps" value={v('biceps')} maxValue={maxValue} x={11} y={40} width={13} height={30} rx={6} />
          <Region region="biceps" value={v('biceps')} maxValue={maxValue} x={76} y={40} width={13} height={30} rx={6} />
          <Region region="antebrazos" value={v('antebrazos')} maxValue={maxValue} x={8} y={72} width={12} height={32} rx={5} />
          <Region region="antebrazos" value={v('antebrazos')} maxValue={maxValue} x={80} y={72} width={12} height={32} rx={5} />
          <Region region="cuadriceps" value={v('cuadriceps')} maxValue={maxValue} x={34} y={89} width={15} height={46} rx={7} />
          <Region region="cuadriceps" value={v('cuadriceps')} maxValue={maxValue} x={51} y={89} width={15} height={46} rx={7} />
          <rect x={35} y={137} width={13} height={40} rx={6} className="body-map-neutral" />
          <rect x={52} y={137} width={13} height={40} rx={6} className="body-map-neutral" />
        </svg>
        <span className="body-map-caption">Frente</span>
      </div>

      <div className="body-map-figure">
        <svg viewBox="0 0 100 190" className="body-map-svg">
          <circle cx={50} cy={14} r={11} className="body-map-neutral" />
          <rect x={44} y={22} width={12} height={8} className="body-map-neutral" />
          <circle cx={27} cy={38} r={10} className="body-map-neutral" />
          <circle cx={73} cy={38} r={10} className="body-map-neutral" />
          <Region region="espalda" value={v('espalda')} maxValue={maxValue} x={30} y={32} width={40} height={56} rx={10} />
          <Region region="triceps" value={v('triceps')} maxValue={maxValue} x={11} y={40} width={13} height={30} rx={6} />
          <Region region="triceps" value={v('triceps')} maxValue={maxValue} x={76} y={40} width={13} height={30} rx={6} />
          <rect x={8} y={72} width={12} height={32} rx={5} className="body-map-neutral" />
          <rect x={80} y={72} width={12} height={32} rx={5} className="body-map-neutral" />
          <Region region="gluteos" value={v('gluteos')} maxValue={maxValue} x={33} y={90} width={34} height={22} rx={11} />
          <Region region="isquios" value={v('isquios')} maxValue={maxValue} x={34} y={113} width={15} height={32} rx={7} />
          <Region region="isquios" value={v('isquios')} maxValue={maxValue} x={51} y={113} width={15} height={32} rx={7} />
          <Region region="gemelo" value={v('gemelo')} maxValue={maxValue} x={35} y={147} width={13} height={30} rx={6} />
          <Region region="gemelo" value={v('gemelo')} maxValue={maxValue} x={52} y={147} width={13} height={30} rx={6} />
        </svg>
        <span className="body-map-caption">Espalda</span>
      </div>
    </div>
  )
}
