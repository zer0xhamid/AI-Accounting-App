import { HashRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import AIInputPage from './pages/AIInputPage'
import TransactionsPage from './pages/TransactionsPage'
import ManualEntryPage from './pages/ManualEntryPage'
import InventoryPage from './pages/InventoryPage'
import PersonsPage from './pages/PersonsPage'
import PersonDetailPage from './pages/PersonDetailPage'
import ExpensesPage from './pages/ExpensesPage'
import ReportsPage from './pages/ReportsPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import ToastContainer from './components/ui/ToastContainer'

export default function App() {
  return (
    <HashRouter>
      <ToastContainer />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ai-input" element={<AIInputPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/transactions/new" element={<ManualEntryPage />} />
          <Route path="/transactions/:id" element={<ManualEntryPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/persons" element={<PersonsPage />} />
          <Route path="/persons/:id" element={<PersonDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
