import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import type { NavState } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useMeetupPhotoThumbs, useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import {
  addMeetup,
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
import { useToday } from '../hooks/useToday'
import { activitySuggestions } from '../lib/activities'
import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
import { isPlainEnter } from '../lib/keys'
import { askToKeepData } from '../lib/persist'
import { compareNames, formatNameList } from '../lib/text'
import { recentFriends } from '../stats/recent'
import type { Friend } from '../types'
import { MeetupActivities } from './MeetupActivities'
import { MeetupPhotos, type DraftPhoto } from './MeetupPhotos'
import type { MeetupSheetRequest } from './sheetsContext'
import './MeetupSheet.css'

interface MeetupSheetProps {
  request: MeetupSheetRequest | null
  onClose: () => void
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (isPlainEnter(event)) event.currentTarget.blur()
}

const UNDO_FAILED = "Couldn't undo. Please try again."

export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
  const [initial] = useState(request)
  const editing = initial?.meetup
  const friends = useFriends()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const whoId = useId()
  const whatId = useId()
  const whenId = useId()

  const [start] = useState(() => ({
    friendIds: editing?.friendIds ?? (initial?.presetFriendId ? [initial.presetFriendId] : []),
    typeId: editing?.typeId ?? null,
    date: editing?.date ?? todayISO(),
    activities: editing?.activities ?? [],
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [activities, setActivities] = useState<string[]>(start.activities)
  const [activityDraft, setActivityDraft] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Photos change only in the sheet until Save. A saved meetup's photos load once, as ids and thumbnails.
  const storedPhotos = useMeetupPhotoThumbs(editing?.id)
  const [photos, setPhotos] = useState<DraftPhoto[] | null>(null)
  const [startPhotoIds, setStartPhotoIds] = useState<string[]>([])
  const [addingPhotos, setAddingPhotos] = useState(false)
  if (photos === null && storedPhotos) {
    setPhotos(storedPhotos)
    setStartPhotoIds(storedPhotos.map((photo) => photo.id))
  }
  // Once the sheet closes, drop the full images of photos added in it: they were only waiting for Save.
  useEffect(() => {
    if (request === null) {
      setPhotos((current) =>
        current?.some((photo) => photo.added) ? current.map(({ id, thumb }) => ({ id, thumb })) : current,
      )
    }
  }, [request])
  const suggestions = useMemo(() => activitySuggestions(meetups ?? []), [meetups])

  const effectiveTypeId = typeId ?? types?.[0]?.id ?? null
  const yesterday = addDays(today, -1)
  const isOtherDate = date !== today && date !== yesterday

  const friendById = useMemo(() => new Map((friends ?? []).map((f) => [f.id, f] as const)), [friends])
  const selected = friendIds.map((id) => friendById.get(id)).filter((f): f is Friend => f !== undefined)
  const recent = useMemo(
    () => (friends && meetups ? recentFriends(friends, meetups, today) : []),
    [friends, meetups, today],
  )
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q || !friends) return []
    return friends
      .filter((f) => f.name.toLocaleLowerCase().includes(q))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, 20)
  }, [friends, query])

  const startTypeId = start.typeId ?? types?.[0]?.id ?? null
  const sameFriends = [...friendIds].sort().join() === [...start.friendIds].sort().join()
  const dirty =
    !sameFriends ||
    effectiveTypeId !== startTypeId ||
    date !== start.date ||
    activities.join('\n') !== start.activities.join('\n') ||
    !!activityDraft?.trim() ||
    (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())

  function toggleFriend(id: string) {
    setFriendIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
    setError(null)
  }

  function addFriendId(id: string) {
    setFriendIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setError(null)
  }

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  /** Saves the sheet; with `writeDay`, a new meetup then opens its day page, over its Meetup page. */
  async function save(writeDay = false) {
    if (savingRef.current || addingPhotos) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
    setSaving(true)
    try {
      // An activity typed into "+ New" but not added yet is saved too.
      const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
      const input = { date, typeId: effectiveTypeId, friendIds, activities: typed }
      const unchanged =
        !photos ||
        (photos.every((photo) => !photo.added) &&
          photos.length === startPhotoIds.length &&
          photos.every((photo, i) => photo.id === startPhotoIds[i]))
      const photoChanges: PhotoChanges = !unchanged && photos
        ? {
            add: photos.flatMap((photo) => (photo.added ? [photo.added] : [])),
            removeIds: startPhotoIds.filter((id) => !photos.some((photo) => photo.id === id)),
            order: photos.map((photo) => photo.id),
          }
        : NO_PHOTO_CHANGES
      let added: string | null = null
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        added = meetup.id
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
          onAction: () => {
            deleteMeetup(meetup.id).catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
          },
        })
      }
      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
      if (photoChanges.add.length > 0) void askToKeepData()
      onClose()
      if (writeDay && added) {
        // Back from the day lands on the new memory, whose back button says the friend's name when the sheet
        // was opened from their page.
        const presetFriend = initial?.presetFriendId ? friendById.get(initial.presetFriendId) : undefined
        const fromHere: NavState = { backLabel: presetFriend?.name, tab: (location.state as NavState | null)?.tab }
        navigate(`/meetups/${added}`, { state: fromHere })
        navigate(`/meetups/${added}/day`)
      }
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const saveDisabled = saving || addingPhotos || friendIds.length === 0 || effectiveTypeId === null

  async function remove() {
    if (!editing) return
    let deleted
    try {
      deleted = await deleteMeetup(editing.id)
    } catch {
      setError("Couldn't delete. Please try again.")
      return
    }
    onClose()
    if (deleted) {
      toast({
        message: 'Meetup deleted',
        tone: 'plain',
        actionLabel: 'Undo',
        onAction: () => {
          restoreMeetup(deleted)
            .then((restored) => {
              if (!restored) toast({ message: "Couldn't undo: a friend or type in it was deleted.", tone: 'plain' })
            })
            .catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
        },
      })
    }
  }

  return (
    <Sheet
      open={request !== null}
      title={editing ? 'Edit meetup' : 'Log meetup'}
      onRequestClose={requestClose}
      footer={
        <>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {/* Never hidden for a missing friend (only while the keyboard is up), so Save never moves. */}
          {!editing && (
            <button
              type="button"
              className="text-button meetup-sheet__write"
              onClick={() => void save(true)}
              disabled={saveDisabled}
            >
              Save and write about the day
            </button>
          )}
          <button
            type="button"
            className="button button--primary button--block"
            onClick={() => void save()}
            disabled={saveDisabled}
          >
            {friendIds.length === 0 ? 'Pick a friend' : 'Save'}
          </button>
        </>
      }
    >
      <section className="form-section" aria-labelledby={whoId}>
        <h3 id={whoId} className="form-section__label">
          Who
        </h3>
        {selected.length > 0 && (
          <div className="chip-wrap" role="group" aria-label="Selected friends">
            {selected.map((friend) => (
              <Chip
                key={friend.id}
                active
                onClick={() => toggleFriend(friend.id)}
                ariaLabel={`Remove ${friend.name}`}
              >
                <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={24} />
                {friend.name}
                <IconClose size={14} strokeWidth={2.6} />
              </Chip>
            ))}
          </div>
        )}
        {recent.length > 0 && (
          <div className="recent-friends" role="group" aria-label="Recent friends">
            {recent.map((friend) => {
              const on = friendIds.includes(friend.id)
              return (
                <button
                  key={friend.id}
                  type="button"
                  className="recent-friend"
                  aria-pressed={on}
                  onClick={() => toggleFriend(friend.id)}
                >
                  <span className="recent-friend__avatar">
                    <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={52} />
                    {on && (
                      <span className="recent-friend__check">
                        <IconCheck size={14} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="recent-friend__name">{friend.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <label className="search">
          <IconSearch size={18} />
          <input
            ref={searchRef}
            type="search"
            className="search__input"
            placeholder="Search all friends"
            aria-label="Search all friends"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={blurOnEnter}
          />
        </label>
        {query.trim() !== '' &&
          (results.length > 0 ? (
            <div role="group" aria-label="Search results">
              <InsetGroup>
                {results.map((friend) => (
                  <Row
                    key={friend.id}
                    onClick={() => {
                      addFriendId(friend.id)
                      setQuery('')
                      searchRef.current?.focus()
                    }}
                    leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                    title={friend.name}
                    trailing={friendIds.includes(friend.id) ? <IconCheck size={20} /> : undefined}
                  />
                ))}
              </InsetGroup>
            </div>
          ) : (
            <p className="list-message">No friends match “{query.trim()}”.</p>
          ))}
      </section>

      <section className="form-section" aria-labelledby={whatId}>
        <h3 id={whatId} className="form-section__label">
          What
        </h3>
        <div className="chip-row" role="group" aria-labelledby={whatId}>
          {(types ?? []).map((type) => (
            <Chip key={type.id} selected={type.id === effectiveTypeId} onClick={() => {
                setTypeId(type.id)
                setError(null)
              }}>
              <span aria-hidden="true">{type.emoji}</span>
              {type.name}
            </Chip>
          ))}
        </div>
      </section>

      <section className="form-section" aria-labelledby={whenId}>
        <h3 id={whenId} className="form-section__label">
          When
        </h3>
        <div className="chip-wrap" role="group" aria-labelledby={whenId}>
          <Chip selected={date === today} onClick={() => {
              setDate(today)
              setError(null)
            }}>
            Today
          </Chip>
          <Chip selected={date === yesterday} onClick={() => {
              setDate(yesterday)
              setError(null)
            }}>
            Yesterday
          </Chip>
          <label className="chip date-chip" data-selected={isOtherDate}>
            <IconCalendar size={16} />
            {isOtherDate ? formatDate(date, today) : 'Pick date'}
            <input
              type="date"
              className="date-chip__input"
              aria-label={isOtherDate ? `Date, ${formatDate(date, today)}` : 'Pick date'}
              value={date}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker()
                } catch {
                  // Older browsers open the picker on their own.
                }
              }}
              onChange={(event) => {
                if (isISODate(event.target.value)) {
                  setDate(event.target.value)
                  setError(null)
                }
              }}
            />
          </label>
        </div>
      </section>

      <MeetupActivities
        suggestions={suggestions}
        selected={activities}
        onChange={(next) => {
          setActivities(next)
          setError(null)
        }}
        draft={activityDraft}
        onDraftChange={setActivityDraft}
      />

      {photos && (
        <MeetupPhotos
          photos={photos}
          setPhotos={setPhotos}
          onBusyChange={setAddingPhotos}
          open={request !== null}
        />
      )}

      {editing && (
        <InsetGroup>
          <Row title="Delete meetup" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
