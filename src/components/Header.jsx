
import { Search, Bell, ChevronDown } from 'lucide-react'

function Header() {
  return (
    <header className="header">
      <div className="header-search">
        <Search size={19} />
        <input
          type="text"
          placeholder="Search products, farmers, or transactions..."
        />
      </div>

      <div className="header-right">
        <button className="notification-button">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        <div className="profile">
          <div className="profile-avatar">TF</div>

          <div className="profile-info">
            <h4>TraceFarm Admin</h4>
            <span>Administrator</span>
          </div>

          <ChevronDown size={17} />
        </div>
      </div>
    </header>
  )
}

export default Header
