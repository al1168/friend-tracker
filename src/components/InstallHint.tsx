import { IconClose, IconShare } from './icons'
import './InstallHint.css'

export function InstallHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="install-hint" aria-label="Install the app">
      <div>
        <p className="install-hint__title">Add Friends to your Home Screen</p>
        <p className="install-hint__body">
          Tap <IconShare size={16} /> Share, then “Add to Home Screen”. Open the app from there, since that’s where
          your data is saved.
        </p>
      </div>
      <button type="button" className="icon-button install-hint__close" onClick={onDismiss} aria-label="Dismiss">
        <IconClose size={20} />
      </button>
    </aside>
  )
}
