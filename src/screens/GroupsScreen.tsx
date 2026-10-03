import { useId, useRef, useState } from 'react'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { EmptyState } from '../components/EmptyState'
import { IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useGroups } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addGroup, deleteGroup, renameGroup } from '../db/groups'
import { isPlainEnter } from '../lib/keys'
import { plural } from '../lib/text'
import type { Group } from '../types'

interface GroupRequest {
  group?: Group
}

export function GroupsScreen() {
  const groups = useGroups()
  const friends = useFriends()
  const [request, setRequest] = useState<GroupRequest | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  if (!groups || !friends) return null

  const counts = new Map<string, number>()
  for (const friend of friends) {
    if (friend.groupId) counts.set(friend.groupId, (counts.get(friend.groupId) ?? 0) + 1)
  }

  const open = (group?: Group) => {
    setSheetKey((key) => key + 1)
    setRequest({ group })
  }

  return (
    <Page
      title="Groups"
      back={{ label: 'Settings', fallback: '/settings' }}
      pushed
      actions={
        <button type="button" className="icon-button" onClick={() => open()} aria-label="Add group">
          <IconPlus />
        </button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet."
          message="Groups like College or Work let you filter friends and compare stats."
          action={
            <button type="button" className="button button--primary" onClick={() => open()}>
              Add group
            </button>
          }
        />
      ) : (
        <InsetGroup footer="Tap a group to rename or delete it.">
          {groups.map((group) => (
            <Row
              key={group.id}
              title={group.name}
              trailing={plural(counts.get(group.id) ?? 0, 'friend')}
              onClick={() => open(group)}
              chevron
            />
          ))}
        </InsetGroup>
      )}
      <GroupSheet key={sheetKey} request={request} onClose={() => setRequest(null)} />
    </Page>
  )
}

function GroupSheet({ request, onClose }: { request: GroupRequest | null; onClose: () => void }) {
  const [initial] = useState(request)
  const group = initial?.group
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const nameId = useId()
  const errorId = useId()
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(group?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<'name' | null>(null)

  async function requestClose() {
    if (await confirmDiscard(name !== (group?.name ?? ''))) onClose()
  }

  async function save() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (group) await renameGroup(group.id, name)
      else await addGroup(name)
      onClose()
    } catch (caught) {
      const validation = caught instanceof ValidationError
      setError(validation ? caught.message : "Couldn't save. Please try again.")
      setErrorField(validation ? 'name' : null)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function remove() {
    if (!group) return
    const confirmed = await confirm({
      title: `Delete ${group.name}?`,
      message: 'Friends in this group will just be ungrouped.',
      confirmLabel: 'Delete group',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteGroup(group.id)
    } catch {
      setError("Couldn't delete. Please try again.")
      setErrorField(null)
      return
    }
    onClose()
    toast({ message: `Deleted ${group.name}`, tone: 'plain' })
  }

  return (
    <Sheet
      open={request !== null}
      title={group ? 'Edit group' : 'New group'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save} disabled={saving}>
          Save
        </button>
      }
    >
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
          onKeyDown={(event) => {
            if (isPlainEnter(event)) {
              event.preventDefault()
              void save()
            }
          }}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
        />
        {error && (
          <p className="field-error" id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
      {group && (
        <InsetGroup>
          <Row title="Delete group" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
