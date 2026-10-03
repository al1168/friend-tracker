import { initials } from '../lib/text'
import { tintIndex } from '../lib/tint'
import './Avatar.css'

interface AvatarProps {
  name: string
  photo: string | null
  /** Stable value (the friend id) so the tint survives renames. */
  seed: string
  size?: number
}

export function Avatar({ name, photo, seed, size = 44 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (photo) return <img className="avatar" src={photo} alt="" style={style} />
  return (
    <span className={`avatar avatar--initials tint-${tintIndex(seed)}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
