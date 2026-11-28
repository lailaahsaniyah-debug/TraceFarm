
import {
  Sprout,
  LayoutDashboard,
  Package,
  PlusCircle,
  Map,
  QrCode,
  ShieldCheck,
  Settings
} from 'lucide-react'

function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Products', icon: Package },
    { name: 'Add Product', icon: PlusCircle },
    { name: 'Tracking', icon: Map },
    { name: 'QR Generator', icon: QrCode },
    { name: 'Verification', icon: ShieldCheck }
  ]

  const selectPage = (page) => setActivePage(page)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Sprout size={25} />
        </div>
        <div>
          <h2>TraceFarm</h2>
          <span>AGRICULTURE TRACEABILITY</span>
        </div>
      </div>

      <div className="sidebar-menu">
        <p className="menu-label">MAIN MENU</p>

        {menuItems.map(({ name, icon: Icon }) => (
          <button
            key={name}
            type="button"
            className={`menu-item ${activePage === name ? 'active' : ''}`}
            onClick={() => selectPage(name)}
          >
            <Icon size={19} />
            <span>{name}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`menu-item ${activePage === 'Settings' ? 'active' : ''}`}
          onClick={() => selectPage('Settings')}
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>

        <div className="sidebar-footer">
          <span>TraceFarm v1.0</span>
          <span>Powered by Solana</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
