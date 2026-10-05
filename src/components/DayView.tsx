import { clockStyle, formatDayTime, speakTime, type ClockStyle } from '../lib/clock'
import type { DayLine, DayPart, DayStop } from '../lib/dayText'
import { paidBy } from '../lib/payers'
import { plural } from '../lib/text'
import type { Friend } from '../types'
import { Avatar } from './Avatar'
import './DayView.css'

interface DayViewProps {
  /** The day as readDay reads it. */
  parts: DayPart[]
  /** The friends on the meetup, for the face beside "Jessie paid". */
  people: Friend[]
}

/**
 * The day read back on the Meetup page: places as a timeline, headings, and the rest as prose, all in the
 * owner's words. Reading only changes how the text looks, never the text.
 */
export function DayView({ parts, people }: DayViewProps) {
  const style = clockStyle()
  return (
    <div className="day-view">
      {parts.map((part, index) => {
        if (part.kind === 'heading') {
          return (
            <h3 key={index} className="day-heading">
              {part.text}
            </h3>
          )
        }
        if (part.kind === 'timeline') {
          return (
            <ol key={index} className="day-timeline" aria-label={`Places, ${plural(part.stops.length, 'stop')}`}>
              {part.stops.map((stop, stopIndex) => (
                <DayStopView key={stopIndex} stop={stop} people={people} style={style} />
              ))}
            </ol>
          )
        }
        return (
          <div key={index} className="day-prose">
            {part.lines.map((line, lineIndex) =>
              line.kind === 'gap' ? (
                <div key={lineIndex} className="day-gap" aria-hidden="true" />
              ) : (
                <DayLineView key={lineIndex} line={line} people={people} />
              ),
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayStopView({ stop, people, style }: { stop: DayStop; people: Friend[]; style: ClockStyle }) {
  const spoken = speakTime(stop, style)
  return (
    <li className="day-stop">
      {/* The time column is for the eye; VoiceOver hears the sentence after the place. */}
      <div className="day-stop__time numeric" aria-hidden="true">
        {stop.start && <span>{formatDayTime(stop.start, style)}</span>}{' '}
        {stop.end && <span>to {formatDayTime(stop.end, style)}</span>}
      </div>
      <div className="day-stop__main">
        <h3 className="day-stop__place">{stop.place}</h3>
        {spoken && <p className="visually-hidden">{spoken}</p>}
        {stop.lines.map((line, index) => (
          <DayLineView key={index} line={line} people={people} />
        ))}
      </div>
    </li>
  )
}

function DayLineView({ line, people }: { line: DayLine; people: Friend[] }) {
  if (line.kind === 'text') return <p className="day-line">{line.text}</p>
  const friend = paidBy(line.who, people)
  return (
    <p className="day-line">
      <span className="paid-tag">
        <span aria-hidden="true">🧾</span>
        {friend && <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={20} />}
        {line.text}
      </span>
    </p>
  )
}
