
import { useState } from 'react'

import Sidebar from './components/Sidebar'
import Header from './components/Header'

import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import AddProduct from './pages/AddProduct'
import Tracking from './pages/Tracking'
import QRGenerator from './pages/QRGenerator'
import Verification from './pages/Verification'
import Settings from './pages/Settings'
import PublicTrace from './pages/PublicTrace'

import './styles/App.css'

function App() {
  const [activePage, setActivePage] = useState('Dashboard')

  const traceMatch = window.location.pathname.match(
    /^\/trace\/([^/]+)\/?$/
  )

  if (traceMatch) {
    const batchId = decodeURIComponent(traceMatch[1])

    return <PublicTrace batchId={batchId} />
  }

  function renderPage() {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard setActivePage={setActivePage} />

      case 'Products':
        return <Products setActivePage={setActivePage} />

      case 'Add Product':
        return <AddProduct />

      case 'Tracking':
        return <Tracking />

      case 'QR Generator':
        return <QRGenerator />

      case 'Verification':
        return <Verification />

      case 'Settings':
        return <Settings />

      default:
        return <Dashboard setActivePage={setActivePage} />
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="main-content">
        <Header setActivePage={setActivePage} />
        {renderPage()}
      </main>
    </div>
  )
}

export default App
