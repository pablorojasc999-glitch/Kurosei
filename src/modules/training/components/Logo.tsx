import logoMark from '../../../assets/logo-mark.png'

interface LogoProps {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  const content = (
    <>
      <img src={logoMark} alt="" className="app-logo-mark" />
      <span className="app-logo-word">Kurosei</span>
    </>
  )

  if (!onClick) {
    return <div className="app-logo">{content}</div>
  }

  return (
    <button type="button" className="app-logo app-logo-button" onClick={onClick}>
      {content}
    </button>
  )
}
