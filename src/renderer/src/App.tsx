import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NewApplication } from './pages/NewApplication'
import { Library } from './pages/Library'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { Processing } from './pages/Processing'
import { Review } from './pages/Review'

export function App(): JSX.Element {
  const location = useLocation()
  return (
    <div className="shell">
      <Sidebar />
      <main className="main" id="main">
        {/* Keyed on the path so each screen change replays the fade + rise. */}
        <div className="screen" key={location.pathname}>
          <ErrorBoundary resetKey={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<NewApplication />} />
            <Route path="/library" element={<Library />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/review/:id" element={<Review />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
