import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Overview from './pages/Overview'
import ProjectChat from './pages/ProjectChat'
import SkillsPage from './pages/SkillsPage'
import MCPPage from './pages/MCPPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/project/:id" element={<ProjectChat />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/mcp" element={<MCPPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
