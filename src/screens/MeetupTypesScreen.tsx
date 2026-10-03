import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { IconArrowDown, IconArrowUp, IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addMeetupType, deleteMeetupType, moveMeetupType, updateMeetupType } from '../db/meetupTypes'
import { isPlainEnter } from '../lib/keys'
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
  const toast = useToast()
  const pendingFocus = useRef<{ id: string; dir: 'up' | 'down' } | null>(null)
  const orderRef = useRef<HTMLDivElement>(null)

  // Keep keyboard/VoiceOver focus on the moved type's arrow once the live query re-renders.
  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending || !types) return
    pendingFocus.current = null
    const find = (dir: string) =>
      orderRef.current?.querySelector<HTMLButtonElement>(`[data-move="${pending.id}:${dir}"]`) ?? null
    let target = find(pending.dir)
    if (target?.disabled) target = find(pending.dir === 'up' ? 'down' : 'up')
    target?.focus()
  }, [types])

  if (!types || !meetups) return null

  const usage = new Map<string, number>()
  for (const meetup of meetups) usage.set(meetup.typeId, (usage.get(meetup.typeId) ?? 0) + 1)

  const open = (type?: MeetupType) => {
    setSheetKey((key) => key + 1)
    setRequest({ type })
  }

  const move = async (id: string, dir: 'up' | 'down') => {
    pendingFocus.current = { id, dir }
    try {
      await moveMeetupType(id, dir === 'up' ? -1 : 1)
    } catch {
      pendingFocus.current = null
      toast({ message: "Couldn't move that type. Please try again.", tone: 'plain' })
    }
  }

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
      <div ref={orderRef}>
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
                data-move={`${type.id}:up`}
                disabled={index === 0}
                onClick={() => void move(type.id, 'up')}
              >
                <IconArrowUp size={20} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move ${type.name} down`}
                data-move={`${type.id}:down`}
                disabled={index === types.length - 1}
                onClick={() => void move(type.id, 'down')}
              >
                <IconArrowDown size={20} />
              </button>
            </div>
          </div>
        ))}
      </InsetGroup>
      </div>
      <TypeSheet
        key={sheetKey}
        request={request}
        usageByType={usage}
        isLast={types.length <= 1}
        onClose={() => setRequest(null)}
      />
    </Page>
  )
}

interface TypeSheetProps {
  request: TypeRequest | null
  usageByType: Map<string, number>
  isLast: boolean
  onClose: () => void
}

function TypeSheet({ request, usageByType, isLast, onClose }: TypeSheetProps) {
  const [initial] = useState(request)
  const type = initial?.type
  const usage = type ? (usageByType.get(type.id) ?? 0) : 0
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
  const [errorField, setErrorField] = useState<'name' | 'emoji' | null>(null)

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
      if (caught instanceof ValidationError) {
        setError(caught.message)
        setErrorField(/emoji/i.test(caught.message) ? 'emoji' : 'name')
      } else {
        setError("Couldn't save. Please try again.")
        setErrorField(null)
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (isPlainEnter(event)) {
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
      setErrorField(null)
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
            aria-invalid={error !== null && errorField === 'emoji'}
            aria-describedby={error && errorField === 'emoji' ? errorId : undefined}
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
            aria-invalid={error !== null && errorField === 'name'}
            aria-describedby={error && errorField === 'name' ? errorId : undefined}
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
