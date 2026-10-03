import { Page } from '../components/Page'

export function GroupsScreen() {
  return (
    <Page title="Groups" back={{ label: 'Settings', fallback: '/settings' }} pushed>
      <p className="list-message">Groups will show up here.</p>
    </Page>
  )
}
