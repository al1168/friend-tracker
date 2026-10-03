import { Page } from '../components/Page'

export function FriendDetailScreen() {
  return (
    <Page title="Friend" back={{ label: 'Friends', fallback: '/' }} pushed>
      <p className="list-message">Friend details will show up here.</p>
    </Page>
  )
}
