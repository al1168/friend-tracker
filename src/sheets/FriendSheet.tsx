import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCamera, IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useGroups } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addFriend, deleteFriend, updateFriend } from '../db/friends'
import { addGroup } from '../db/groups'
import { resizeImageToDataUrl } from '../lib/image'
import type { FriendSheetRequest } from './sheetsContext'
import './FriendSheet.css'

interface FriendSheetProps {
  request: FriendSheetRequest | null
  onClose: () => void
}

export function FriendSheet({ request, onClose }: FriendSheetProps) {
  const [initial] = useState(request)
  const editing = initial?.friend
  const groups = useGroups() ?? []
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const notesId = useId()
  const groupLabelId = useId()
  const nameErrorId = useId()
  const groupErrorId = useId()
  const photoErrorId = useId()
  const nameInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(editing?.name ?? '')
  const [groupId, setGroupId] = useState<string | null>(editing?.groupId ?? null)
  const [photo, setPhoto] = useState<string | null>(editing?.photo ?? null)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [newGroupName, setNewGroupName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processingPhoto, setProcessingPhoto] = useState(false)

  const dirty =
    name !== (editing?.name ?? '') ||
    groupId !== (editing?.groupId ?? null) ||
    photo !== (editing?.photo ?? null) ||
    notes !== (editing?.notes ?? '') ||
    !!newGroupName?.trim()

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    if (!name.trim()) {
      setNameError('Please enter a name.')
      nameInput.current?.focus()
      return
    }
    setSaving(true)
    try {
      let finalGroupId = groupId
      if (newGroupName?.trim()) {
        try {
          const group = await addGroup(newGroupName)
          finalGroupId = group.id
          setGroupId(group.id)
          setNewGroupName(null)
          setGroupError(null)
        } catch (error) {
          setGroupError(error instanceof ValidationError ? error.message : "Couldn't add the group.")
          return
        }
      }
      const input = { name, groupId: finalGroupId, photo, notes }
      if (editing) {
        await updateFriend(editing.id, input)
        toast({ message: 'Saved' })
      } else {
        const friend = await addFriend(input)
        toast({ message: `Added ${friend.name}` })
      }
      onClose()
    } catch (error) {
      if (error instanceof ValidationError) setNameError(error.message)
      else toast({ message: "Couldn't save. Please try again.", tone: 'plain' })
    } finally {
      setSaving(false)
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProcessingPhoto(true)
    try {
      setPhoto(await resizeImageToDataUrl(file))
      setPhotoError(null)
    } catch {
      setPhotoError("That image couldn't be used. Try a different photo.")
    } finally {
      setProcessingPhoto(false)
    }
  }

  async function createGroup() {
    try {
      const group = await addGroup(newGroupName ?? '')
      setGroupId(group.id)
      setNewGroupName(null)
      setGroupError(null)
    } catch (error) {
      setGroupError(error instanceof ValidationError ? error.message : "Couldn't add the group.")
    }
  }

  async function remove() {
    if (!editing) return
    const confirmed = await confirm({
      title: `Delete ${editing.name}?`,
      message: 'Meetups with only them are deleted too. Meetups with other friends stay.',
      confirmLabel: 'Delete friend',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteFriend(editing.id)
    } catch {
      toast({ message: "Couldn't delete. Please try again.", tone: 'plain' })
      return
    }
    onClose()
    navigate('/', { replace: true })
    toast({ message: `Deleted ${editing.name}`, tone: 'plain' })
  }

  return (
    <Sheet
      open={request !== null}
      title={editing ? 'Edit friend' : 'New friend'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save} disabled={saving || processingPhoto}>
          Save
        </button>
      }
    >
      <div className="friend-form__photo">
        <button
          type="button"
          className="friend-form__avatar"
          onClick={() => fileInput.current?.click()}
          aria-label={photo ? 'Change photo' : 'Add photo'}
        >
          <Avatar name={name || '?'} photo={photo} seed={editing?.id ?? 'new-friend'} size={96} />
          <span className="friend-form__camera">
            <IconCamera size={18} />
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={choosePhoto}
        />
        {photo && (
          <button type="button" className="text-button" onClick={() => {
              setPhoto(null)
              setPhotoError(null)
            }}
          >
            Remove photo
          </button>
        )}
        {photoError && (
          <p className="field-error" id={photoErrorId} role="alert">
            {photoError}
          </p>
        )}
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor={nameId}>
          Name
        </label>
        <input
          id={nameId}
          ref={nameInput}
          className="field"
          value={name}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? nameErrorId : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          }}
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />
        {nameError && (
          <p className="field-error" id={nameErrorId}>
            {nameError}
          </p>
        )}
      </div>

      <div className="form-section">
        <span className="field-label" id={groupLabelId}>
          Group
        </span>
        <div className="chip-wrap" role="group" aria-labelledby={groupLabelId}>
          <Chip selected={groupId === null} onClick={() => setGroupId(null)}>
            None
          </Chip>
          {groups.map((group) => (
            <Chip key={group.id} selected={groupId === group.id} onClick={() => setGroupId(group.id)}>
              {group.name}
            </Chip>
          ))}
          {newGroupName === null && (
            <Chip onClick={() => setNewGroupName('')}>
              <IconPlus size={16} strokeWidth={2.4} />
              New group
            </Chip>
          )}
        </div>
        {newGroupName !== null && (
          <div className="friend-form__new-group">
            <input
              className="field"
              value={newGroupName}
              placeholder="Group name"
              aria-label="New group name"
              aria-invalid={groupError !== null}
              aria-describedby={groupError ? groupErrorId : undefined}
              autoFocus
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={(event) => {
                setNewGroupName(event.target.value)
                setGroupError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createGroup()
                }
              }}
            />
            <button type="button" className="button button--secondary" onClick={createGroup}>
              Add
            </button>
          </div>
        )}
        {groupError && (
          <p className="field-error" id={groupErrorId}>
            {groupError}
          </p>
        )}
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="field"
          rows={3}
          value={notes}
          placeholder="Birthday, partner's name, favorite things"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {editing && (
        <InsetGroup>
          <Row title="Delete friend" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
