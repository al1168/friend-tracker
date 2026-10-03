import { Page } from '../components/Page'

export function MeetupTypesScreen() {
  return (
    <Page title="Meetup types" back={{ label: 'Settings', fallback: '/settings' }} pushed>
      <p className="list-message">Meetup types will show up here.</p>
    </Page>
  )
}
