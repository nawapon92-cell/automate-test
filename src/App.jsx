import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import WidgetSettings from './pages/WidgetSettings'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import TestResults from './pages/TestResults'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/widget" replace />} />
        <Route path="widget" element={<WidgetSettings />} />
        <Route path="categories" element={<Categories />} />
        <Route path="categories/:id" element={<CategoryDetail />} />
        <Route path="results" element={<TestResults />} />
      </Route>
    </Routes>
  )
}
