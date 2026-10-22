import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { BackupDotProvider } from './backup/BackupDotProvider'
import { RestoreUndoCleanup } from './backup/RestoreUndoCleanup'
import { ActionSheetProvider } from './components/ActionSheet'
import { PlaceMemoryProvider } from './components/PlaceMemory'
import { ScrollManager } from './components/ScrollManager'
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { MeetupIdsWithPhotosProvider } from './data/MeetupIdsWithPhotosProvider'
import { ReminderSync } from './reminders/useReminderSync'
import { DayScreen } from './screens/DayScreen'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
import { MeetupScreen } from './screens/MeetupScreen'
import { MeetupsScreen } from './screens/MeetupsScreen'
import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SheetsProvider } from './sheets/SheetsProvider'
import { StatsScreen } from './screens/StatsScreen'

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ActionSheetProvider>
          <SheetsProvider>
            {/* Inside App, so the app lock (which unmounts App) forgets every list's place. */}
            <PlaceMemoryProvider>
              <MeetupIdsWithPhotosProvider>
                <ScrollManager />
                <ReminderSync />
                <RestoreUndoCleanup />
                {/* One backup dot query, shared by the tab bar and Settings. */}
                <BackupDotProvider>
                  <main className="app">
                    <Routes>
                      <Route path="/" element={<FriendsScreen />} />
                      <Route path="/friends/:id" element={<FriendDetailScreen />} />
                      <Route path="/meetups" element={<MeetupsScreen />} />
                      <Route path="/meetups/:id" element={<MeetupScreen />} />
                      <Route path="/meetups/:id/day" element={<DayScreen />} />
                      <Route path="/stats" element={<StatsScreen />} />
                      <Route path="/settings" element={<SettingsScreen />} />
                      <Route path="/settings/groups" element={<GroupsScreen />} />
                      <Route path="/settings/types" element={<MeetupTypesScreen />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                  <TabBar />
                </BackupDotProvider>
              </MeetupIdsWithPhotosProvider>
            </PlaceMemoryProvider>
          </SheetsProvider>
        </ActionSheetProvider>
      </ToastProvider>
    </HashRouter>
  )
}
