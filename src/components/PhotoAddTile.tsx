import type { PhotoAdder } from '../hooks/usePhotoAdder'
import { IconCameraPlus } from './icons'

/**
 * The Add photos tile, last in a photo grid, with the picker it opens. While a batch is added it reads "Adding 2 of
 * 5…" and is aria-disabled, never disabled, so focus stays on it.
 */
export function PhotoAddTile({ adder }: { adder: PhotoAdder }) {
  const { progress, message } = adder
  return (
    <li className="photo-tile">
      <button
        type="button"
        className="photo-add"
        aria-disabled={progress !== null}
        aria-describedby={message ? adder.messageId : undefined}
        onClick={adder.open}
      >
        <IconCameraPlus size={26} />
        <span>{progress ? `Adding ${progress.current} of ${progress.total}…` : 'Add photos'}</span>
      </button>
      <input
        ref={adder.inputRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={adder.onChange}
      />
    </li>
  )
}

/** Why some photos weren't added, under the grid: a Footnote hint (never red), said as it appears. */
export function PhotoAddHint({ adder }: { adder: PhotoAdder }) {
  const { message } = adder
  if (!message) return null
  return (
    <p key={message.n} id={adder.messageId} className="field-hint" role="alert">
      {message.text}
    </p>
  )
}
