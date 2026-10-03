import { useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { useActionSheet } from '../components/ActionSheet'
import { Chip } from '../components/Chip'
import { IconClose, IconPlus } from '../components/icons'
import { Section } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { ValidationError } from '../db/errors'
import {
  addPreferences,
  ITEM_TOO_LONG,
  LIST_FULL,
  movePreference,
  removePreference,
  restorePreference,
} from '../db/preferences'
import { isPlainEnter } from '../lib/keys'
import {
  indexOfItem,
  MAX_ITEM_LENGTH,
  MAX_ITEMS,
  otherKind,
  splitItems,
  type PreferenceKind,
} from '../lib/preferences'
import { formatNameList } from '../lib/text'
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

/** Where focus goes once the lists have re-rendered, so it never falls to the page when a chip goes away. */
type FocusTarget =
  /** `quiet` focuses without the focus ring (for touch users after Done). */
  | { kind: PreferenceKind; mode: 'add'; quiet?: boolean }
  | { kind: PreferenceKind; mode: 'removed'; item: string; index: number }
  | { kind: PreferenceKind; mode: 'item'; item: string }

/** The friend page's Likes and Dislikes sections. */
export function FriendPreferences({ friend }: { friend: Friend }) {
  const showActionSheet = useActionSheet()
  const toast = useToast()
  const messageId = useId()
  const [draft, setDraft] = useState<Draft | null>(null)
  const submittingRef = useRef(false)
  const listRefs = useRef<Record<PreferenceKind, HTMLDivElement | null>>({ likes: null, dislikes: null })
  const pendingFocus = useRef<FocusTarget | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })

  function focusAfterRender(target: FocusTarget) {
    pendingFocus.current = target
    setFocusTick((tick) => tick + 1)
  }

  // Runs once the lists (or the open field) have re-rendered. A removed chip's focus moves to the chip that took its
  // place, else the one before it, else "+ Add"; a moved chip's focus follows it to the other list.
  useEffect(() => {
    const pending = pendingFocus.current
    const list = pending && listRefs.current[pending.kind]
    if (!pending || !list) return
    const chips = list.querySelectorAll<HTMLButtonElement>('.chip--wrap')
    const addChip = () => list.querySelector<HTMLButtonElement>('.chip:not(.chip--wrap)')
    let target: HTMLButtonElement | null | undefined
    if (pending.mode === 'add') {
      target = addChip()
    } else if (pending.mode === 'removed') {
      if (indexOfItem(friend[pending.kind], pending.item) !== -1) return // The change hasn't arrived yet.
      target = chips[pending.index] ?? chips[pending.index - 1] ?? addChip()
    } else {
      const index = indexOfItem(friend[pending.kind], pending.item)
      if (index === -1) return
      target = chips[index]
    }
    pendingFocus.current = null
    // `focusVisible` is in WebKit and Firefox but not yet in TypeScript's FocusOptions.
    const options: FocusOptions & { focusVisible?: boolean } = { preventScroll: true }
    if (pending.mode === 'add' && pending.quiet) options.focusVisible = false
    target?.focus(options)
  }, [friend, draft, focusTick])

  /** What would stop this text from being saved, or null. Mirrors the rules in `addPreferences`. */
  function problemWith(kind: PreferenceKind, text: string): string | null {
    const items = splitItems(text)
    if (items.some((item) => item.length > MAX_ITEM_LENGTH)) return ITEM_TOO_LONG
    const list = [...friend[kind]]
    for (const item of items) if (indexOfItem(list, item) === -1) list.push(item)
    return list.length > MAX_ITEMS ? LIST_FULL : null
  }

  function toastProblem(error: unknown, fallback: string) {
    toast({ message: error instanceof ValidationError ? error.message : fallback, tone: 'plain' })
  }

  function open(kind: PreferenceKind) {
    // Opening one list's field closes the other's, saving what was typed there. (The old field
    // is removed while it has focus, and React doesn't run onBlur for it, so it's saved once.)
    if (draft && draft.text.trim()) {
      // Text that can't be saved stays where it is, with its note, rather than being lost with the field.
      const problem = problemWith(draft.kind, draft.text)
      if (problem) {
        showMessage(draft.kind, problem)
        return
      }
      void saveClosed(draft.kind, draft.text)
    }
    clearAnnouncement()
    setDraft({ kind, text: '', message: null })
  }

  /** The hidden "Added …" note only makes sense right after adding, not when VoiceOver swipes past it later. */
  function clearAnnouncement() {
    setAnnouncement((current) => (current.text ? { text: '', n: current.n } : current))
  }

  function close(kind: PreferenceKind) {
    clearAnnouncement()
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
      if (added.length > 0) setAnnouncement((current) => ({ text: `Added ${formatNameList(added)}.`, n: current.n + 1 }))
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
      focusAfterRender({ kind: otherKind(kind), mode: 'item', item })
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
    focusAfterRender({ kind, mode: 'removed', item, index })
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

  /** Focus left the add row (field and Add button): saves and closes it, unless that would lose the text. */
  function leaveField(kind: PreferenceKind, text: string, event: FocusEvent<HTMLDivElement>) {
    // WebKit blurs the field when the window deactivates (switching apps). Keep the draft as it is.
    if (!document.hasFocus()) return
    // Tabbing from the field to the Add button stays inside the row.
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    if (text.trim()) {
      const problem = problemWith(kind, text)
      if (problem) {
        showMessage(kind, problem)
        return
      }
      void saveClosed(kind, text)
    }
    close(kind)
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
            <div
              className="chip-wrap"
              ref={(element) => {
                listRefs.current[kind] = element
              }}
              onMouseDown={keepFieldFocus}
            >
              {friend[kind].map((item) => (
                <Chip key={item} wrap onClick={() => void chooseAction(kind, item)}>
                  {item}
                </Chip>
              ))}
              {adding ? (
                <div className="preference-add">
                  <div className="preference-add__row" onBlur={(event) => leaveField(kind, adding.text, event)}>
                    <div className="preference-add__input">
                    <input
                      ref={inputRef}
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
                          else {
                            focusAfterRender({ kind, mode: 'add', quiet: true })
                            close(kind)
                          }
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          // Closes without saving: React doesn't run onBlur for a field it removes.
                          focusAfterRender({ kind, mode: 'add' })
                          close(kind)
                        }
                      }}
                    />
                    {adding.text && (
                      <button
                        type="button"
                        className="preference-add__clear"
                        aria-label="Clear text"
                        // Keeps focus in the field, so the keyboard stays up.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setDraft({ kind, text: '', message: null })
                          // The field may have lost focus while it kept unsavable text.
                          inputRef.current?.focus()
                        }}
                      >
                        <span className="preference-add__clear-glyph">
                          <IconClose size={12} strokeWidth={3} />
                        </span>
                      </button>
                    )}
                    </div>
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
      <span className="visually-hidden" aria-live="polite">
        {announcement.text}
        {announcement.text && announcement.n % 2 === 1 ? '\u00a0' : ''}
      </span>
    </>
  )
}
