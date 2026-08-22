import logoMark from '../../../assets/logo-mark.png'

export function Logo() {
  return (
    <div className="app-logo">
      <img src={logoMark} alt="" className="app-logo-mark" />
      <span className="app-logo-word">Kurosei</span>
    </div>
  )
}
