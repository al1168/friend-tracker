import { useId, useRef, useState, type MouseEvent } from 'react'
import { useActionSheet } from '../components/ActionSheet'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { Section } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { ValidationError } from '../db/errors'
import { addPreferences, movePreference, removePreference, restorePreference } from '../db/preferences'
import { isPlainEnter } from '../lib/keys'
import { otherKind, type PreferenceKind } from '../lib/preferences'
import type { Friend } from '../types'
import './FriendPreferences.css'

const KINDS: PreferenceKind[] = ['likes', 'dislikes']

/** Room to type several comma-separated items at once; each item is still held to 60 characters when saved. */
const FIELD_MAX_LENGTH = 300

const COPY: Record<PreferenceKind, { title: string; addLabel: string; fieldLabel: string; placeholder: string }> = {
  likes: { title: 'Likes', addLabel: 'Add a like', fieldLabel: 'New like', placeholder: 'Sushi, hiking…' },
  dislikes: {
    title: 'Dislikes',
    addLabel: 'Add a dislike',
    fieldLabel: 'New dislike',
    placeholder: 'Cilantro, early mornings…',
  },
}

const SAVE_FAILED = "Couldn't save. Please try again."
const UNDO_FAILED = "Couldn't undo. Please try again."

/** The open add field. Only one is open at a time on the page. */
interface Draft {
  kind: PreferenceKind
  text: string
  /** The note under the field. A new `n` re-announces the same text. */
  message: { text: string; n: number } | null
}

/** The friend page's Likes and Dislikes sections. */
export function FriendPreferences({ friend }: { friend: Friend }) {
  const showActionSheet = useActionSheet()
  const toast = useToast()
  const messageId = useId()
  const [draft, setDraft] = useState<Draft | null>(null)
  const submittingRef = useRef(false)

  function toastProblem(error: unknown, fallback: string) {
    toast({ message: error instanceof ValidationError ? error.message : fallback, tone: 'plain' })
  }

  function open(kind: PreferenceKind) {
    // Opening one list's field closes the other's, saving what was typed there. (The old field
    // is removed while it has focus, and React doesn't run onBlur for it, so it's saved once.)
    if (draft && draft.text.trim()) void saveClosed(draft.kind, draft.text)
    setDraft({ kind, text: '', message: null })
  }

  function close(kind: PreferenceKind) {
    setDraft((current) => (current?.kind === kind ? null : current))
  }

  function showMessage(kind: PreferenceKind, text: string | null) {
    setDraft((current) =>
      current?.kind === kind
        ? { ...current, message: text === null ? null : { text, n: (current.message?.n ?? 0) + 1 } }
        : current,
    )
  }

  /** Enter or Add: saves the text, then clears the field and keeps it open for the next one. */
  async function submit(kind: PreferenceKind, text: string) {
    if (submittingRef.current || !text.trim()) return
    submittingRef.current = true
    try {
      const { added, skipped } = await addPreferences(friend.id, kind, text)
      // Clears the field, unless something new was typed while saving.
      setDraft((current) => (current?.kind === kind && current.text === text ? { ...current, text: '' } : current))
      showMessage(kind, added.length === 0 && skipped.length > 0 ? `Already in ${COPY[kind].title}.` : null)
    } catch (error) {
      if (error instanceof ValidationError) showMessage(kind, error.message)
      else toast({ message: SAVE_FAILED, tone: 'plain' })
    } finally {
      submittingRef.current = false
    }
  }

  /** Saves what was left in a field that has closed, so a problem shows as a toast. */
  async function saveClosed(kind: PreferenceKind, text: string) {
    try {
      await addPreferences(friend.id, kind, text)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
    }
  }

  async function move(kind: PreferenceKind, item: string) {
    try {
      await movePreference(friend.id, kind, item)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
    }
  }

  async function remove(kind: PreferenceKind, item: string) {
    const friendId = friend.id
    let index: number
    try {
      index = await removePreference(friendId, kind, item)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
      return
    }
    if (index === -1) return
    toast({
      message: `Removed “${item}”`,
      tone: 'plain',
      actionLabel: 'Undo',
      onAction: () => {
        restorePreference(friendId, kind, item, index).catch((error: unknown) => toastProblem(error, UNDO_FAILED))
      },
    })
  }

  /**
   * While a field is open, tapping a chip or button in the lists doesn't take focus from it. Otherwise
   * the field would blur, save and close first, moving everything under the finger before the tap
   * lands (on Add, the button would vanish). Instead each action decides: Add saves and keeps the
   * field open, the other list's "+ Add" saves this field and switches, and an item's action sheet
   * takes focus, so the field blurs, saves and closes behind it.
   */
  function keepFieldFocus(event: MouseEvent) {
    if (draft && !(event.target instanceof HTMLInputElement)) event.preventDefault()
  }

  async function chooseAction(kind: PreferenceKind, item: string) {
    const choice = await showActionSheet<'move' | 'remove'>({
      title: item,
      actions: [
        { label: `Move to ${COPY[otherKind(kind)].title}`, value: 'move' },
        { label: 'Remove', value: 'remove', destructive: true },
      ],
    })
    if (choice === 'move') await move(kind, item)
    else if (choice === 'remove') await remove(kind, item)
  }

  return (
    <>
      {KINDS.map((kind) => {
        const copy = COPY[kind]
        const adding = draft?.kind === kind ? draft : null
        return (
          <Section key={kind} title={copy.title}>
            <div className="chip-wrap" onMouseDown={keepFieldFocus}>
              {friend[kind].map((item) => (
                <Chip key={item} wrap onClick={() => void chooseAction(kind, item)}>
                  {item}
                </Chip>
              ))}
              {adding ? (
                <div className="preference-add">
                  <div className="preference-add__row">
                    <input
                      className="field"
                      value={adding.text}
                      placeholder={copy.placeholder}
                      aria-label={copy.fieldLabel}
                      aria-describedby={adding.message ? messageId : undefined}
                      autoFocus
                      autoCapitalize="sentences"
                      enterKeyHint="done"
                      maxLength={FIELD_MAX_LENGTH}
                      onChange={(event) => setDraft({ kind, text: event.target.value, message: null })}
                      onKeyDown={(event) => {
                        if (isPlainEnter(event)) {
                          event.preventDefault()
                          // Enter ("done") on an empty field just closes it.
                          if (adding.text.trim()) void submit(kind, adding.text)
                          else event.currentTarget.blur()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          // Closes without saving: React doesn't run onBlur for a field it removes.
                          close(kind)
                        }
                      }}
                      onBlur={() => {
                        close(kind)
                        if (adding.text.trim()) void saveClosed(kind, adding.text)
                      }}
                    />
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => void submit(kind, adding.text)}
                    >
                      Add
                    </button>
                  </div>
                  {adding.message && (
                    <p key={adding.message.n} id={messageId} className="field-hint" role="alert">
                      {adding.message.text}
                    </p>
                  )}
                </div>
              ) : (
                <Chip ariaLabel={copy.addLabel} onClick={() => open(kind)}>
                  <IconPlus size={16} strokeWidth={2.4} />
                  Add
                </Chip>
              )}
            </div>
          </Section>
        )
      })}
    </>
  )
}
