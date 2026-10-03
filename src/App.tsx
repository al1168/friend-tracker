import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ActionSheetProvider } from './components/ActionSheet'
import { ScrollManager } from './components/ScrollManager'
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
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
            <ScrollManager />
            <main className="app">
              <Routes>
                <Route path="/" element={<FriendsScreen />} />
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
                <Route path="/stats" element={<StatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/settings/groups" element={<GroupsScreen />} />
                <Route path="/settings/types" element={<MeetupTypesScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <TabBar />
          </SheetsProvider>
        </ActionSheetProvider>
      </ToastProvider>
    </HashRouter>
  )
}
