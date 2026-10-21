import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { IconChevronDown } from '../components/icons'
import { EMPTY_BIRTHDAY_FIELDS, maxDay, MIN_BIRTH_YEAR, type BirthdayFields } from '../lib/birthdays'
import { MONTH_NAMES, yearOf, type ISODate } from '../lib/dates'
import './BirthdayField.css'

interface BirthdayFieldProps {
  value: BirthdayFields
  /** The message under the row, or null. */
  error: string | null
  today: ISODate
  /** The row, which takes focus when Save finds a problem or Remove birthday empties it. */
  rowRef: RefObject<HTMLDivElement | null>
  onChange: (value: BirthdayFields) => void
}

/** The friend sheet's Birthday section: Month, Day and Year selects in a row, the error under them, and Remove birthday. */
export function BirthdayField({ value, error, today, rowRef, onChange }: BirthdayFieldProps) {
  const labelId = useId()
  const errorId = useId()
  const shownErrorId = error ? errorId : undefined
  const days = Array.from({ length: maxDay(value.month) }, (_, i) => i + 1)
  const thisYear = yearOf(today)
  const years = Array.from({ length: thisYear - MIN_BIRTH_YEAR + 1 }, (_, i) => thisYear - i)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const isSet = value.month !== null || value.day !== null || value.year !== null

  // At large text sizes the error can sit below the visible part of the sheet (or under the keyboard); bring it
  // into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  function changeMonth(month: number | null) {
    // A day the new month doesn't have (Jan 31, then February) goes back to empty.
    const day = value.day !== null && value.day > maxDay(month) ? null : value.day
    onChange({ ...value, month, day })
  }

  function remove() {
    onChange(EMPTY_BIRTHDAY_FIELDS)
    // The button goes away with the birthday, so focus moves to the row instead of falling to the page.
    rowRef.current?.focus()
  }

  return (
    <div className="form-section">
      <span className="field-label" id={labelId}>
        Birthday
      </span>
      <div
        ref={rowRef}
        className="birthday-row"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={shownErrorId}
        tabIndex={-1}
      >
        <BirthdaySelect
          part="month"
          label="Birthday month"
          value={value.month}
          errorId={shownErrorId}
          onChange={changeMonth}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </BirthdaySelect>
        <BirthdaySelect
          part="day"
          label="Birthday day"
          value={value.day}
          errorId={shownErrorId}
          onChange={(day) => onChange({ ...value, day })}
        >
          <option value="">Day</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </BirthdaySelect>
        <BirthdaySelect
          part="year"
          label="Birthday year"
          value={value.year}
          errorId={shownErrorId}
          onChange={(year) => onChange({ ...value, year })}
        >
          <option value="">No year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </BirthdaySelect>
      </div>
      {error && (
        <p ref={errorRef} className="field-error" id={errorId}>
          {error}
        </p>
      )}
      {isSet && (
        <button type="button" className="text-button birthday-remove" onClick={remove}>
          Remove birthday
        </button>
      )}
    </div>
  )
}

interface BirthdaySelectProps {
  part: 'month' | 'day' | 'year'
  label: string
  value: number | null
  /** The error's id while there is one. */
  errorId: string | undefined
  onChange: (value: number | null) => void
  children: ReactNode
}

/** A native select (iOS shows its wheel) with the field look and a chevron. The empty option reads like a placeholder. */
function BirthdaySelect({ part, label, value, errorId, onChange, children }: BirthdaySelectProps) {
  return (
    <span className={`birthday-select birthday-select--${part}`}>
      <select
        className="field"
        aria-label={label}
        aria-invalid={errorId !== undefined}
        aria-describedby={errorId}
        data-empty={value === null}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        {children}
      </select>
      <IconChevronDown size={16} strokeWidth={2.4} />
    </span>
  )
}
