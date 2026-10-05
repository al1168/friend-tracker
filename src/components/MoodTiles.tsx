import { MOODS } from '../lib/moods'
import type { Mood } from '../types'
import { IconCheck } from './icons'
import './MoodTiles.css'

interface MoodTilesProps {
  mood: Mood | null
  onChange: (mood: Mood | null) => void
}

/**
 * The four faces, low to high, as toggle buttons. Nothing is picked at first; tapping the picked face clears it.
 * A mood is a word, never a score (the No Score Rule): no colors and no scale.
 */
export function MoodTiles({ mood, onChange }: MoodTilesProps) {
  return (
    <div className="mood-tiles" role="group" aria-label="Mood">
      {MOODS.map(({ key, emoji, label }) => {
        const picked = mood === key
        return (
          <button
            key={key}
            type="button"
            className="mood-tile"
            aria-pressed={picked}
            onClick={() => onChange(picked ? null : key)}
          >
            <span className="mood-tile__face" aria-hidden="true">
              {emoji}
              {picked && (
                <span className="mood-tile__check">
                  <IconCheck size={14} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="mood-tile__word">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
