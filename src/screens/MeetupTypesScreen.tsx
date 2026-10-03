import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { IconArrowDown, IconArrowUp, IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addMeetupType, deleteMeetupType, moveMeetupType, updateMeetupType } from '../db/meetupTypes'
import { plural } from '../lib/text'
import type { MeetupType } from '../types'
import './MeetupTypesScreen.css'

interface TypeRequest {
  type?: MeetupType
}

export function MeetupTypesScreen() {
  const types = useMeetupTypes()
  const meetups = useMeetups()
  const [request, setRequest] = useState<TypeRequest | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  if (!types || !meetups) return null

  const usage = new Map<string, number>()
  for (const meetup of meetups) usage.set(meetup.typeId, (usage.get(meetup.typeId) ?? 0) + 1)

  const open = (type?: MeetupType) => {
    setSheetKey((key) => key + 1)
    setRequest({ type })
  }
  const editingType = request?.type

  return (
    <Page
      title="Meetup types"
      back={{ label: 'Settings', fallback: '/settings' }}
      pushed
      actions={
        <button type="button" className="icon-button" onClick={() => open()} aria-label="Add type">
          <IconPlus />
        </button>
      }
    >
      <InsetGroup footer="Use the arrows to change the order types appear in when you log a meetup.">
        {types.map((type, index) => (
          <div key={type.id} className="type-row">
            <Row
              onClick={() => open(type)}
              leading={
                <span className="emoji-badge" aria-hidden="true">
                  {type.emoji}
                </span>
              }
              title={type.name}
              subtitle={plural(usage.get(type.id) ?? 0, 'meetup')}
            />
            <div className="type-row__order">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move ${type.name} up`}
                disabled={index === 0}
                onClick={() => void moveMeetupType(type.id, -1)}
              >
                <IconArrowUp size={20} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move ${type.name} down`}
                disabled={index === types.length - 1}
                onClick={() => void moveMeetupType(type.id, 1)}
              >
                <IconArrowDown size={20} />
              </button>
            </div>
          </div>
        ))}
      </InsetGroup>
      <TypeSheet
        key={sheetKey}
        request={request}
        usage={editingType ? (usage.get(editingType.id) ?? 0) : 0}
        isLast={types.length <= 1}
        onClose={() => setRequest(null)}
      />
    </Page>
  )
}

interface TypeSheetProps {
  request: TypeRequest | null
  usage: number
  isLast: boolean
  onClose: () => void
}

function TypeSheet({ request, usage, isLast, onClose }: TypeSheetProps) {
  const [initial] = useState(request)
  const type = initial?.type
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const nameId = useId()
  const emojiId = useId()
  const errorId = useId()
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(type?.name ?? '')
  const [emoji, setEmoji] = useState(type?.emoji ?? '')
  const [error, setError] = useState<string | null>(null)

  const dirty = name !== (type?.name ?? '') || emoji !== (type?.emoji ?? '')
  const deleteBlocker =
    usage > 0
      ? `Used by ${plural(usage, 'meetup')}, so it can't be deleted. You can rename it instead.`
      : isLast
        ? 'You need at least one meetup type.'
        : null

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const input = { name, emoji }
      if (type) await updateMeetupType(type.id, input)
      else await addMeetupType(input)
      onClose()
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
  }

  async function remove() {
    if (!type) return
    const confirmed = await confirm({ title: `Delete ${type.name}?`, confirmLabel: 'Delete type', destructive: true })
    if (!confirmed) return
    try {
      await deleteMeetupType(type.id)
      onClose()
      toast({ message: `Deleted ${type.name}`, tone: 'plain' })
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't delete. Please try again.")
    }
  }

  return (
    <Sheet
      open={request !== null}
      title={type ? 'Edit meetup type' : 'New meetup type'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save} disabled={saving}>
          Save
        </button>
      }
    >
      <div className="type-form">
        <div className="form-section">
          <label className="field-label" htmlFor={emojiId}>
            Emoji
          </label>
          <input
            id={emojiId}
            className="field type-form__emoji"
            value={emoji}
            placeholder="🙂"
            autoComplete="off"
            onKeyDown={submitOnEnter}
            onChange={(event) => {
              setEmoji(event.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="form-section">
          <label className="field-label" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            className="field"
            value={name}
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            onKeyDown={submitOnEnter}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
          />
        </div>
      </div>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {type &&
        (deleteBlocker ? (
          <p className="sheet-note">{deleteBlocker}</p>
        ) : (
          <InsetGroup>
            <Row title="Delete type" destructive onClick={remove} />
          </InsetGroup>
        ))}
    </Sheet>
  )
}
