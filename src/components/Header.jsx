
import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Bell,
  ChevronDown,
  Package,
  Truck,
  ShieldCheck,
  Settings,
  CheckCheck,
  UserRound
} from 'lucide-react'

const API_BASE = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

const DEFAULT_PROFILE = {
  name: 'TraceFarm Admin',
  email: 'admin@tracefarm.com',
  organization: 'TraceFarm Agriculture'
}

const DEFAULT_PREFERENCES = {
  products: true,
  verification: true,
  tracking: true,
  reports: false
}

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...fallback, ...value }
      : fallback
  } catch {
    return fallback
  }
}

function Header({ setActivePage }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState(() =>
    readLocal('tracefarm-profile', DEFAULT_PROFILE)
  )
  const [preferences, setPreferences] = useState(() =>
    readLocal('tracefarm-notifications', DEFAULT_PREFERENCES)
  )
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tracefarm-read-notifications')) || []
    } catch {
      return []
    }
  })

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)

      try {
        const [productResponse, trackingResponse] = await Promise.all([
          fetch(`${API_BASE}/products`),
          fetch(`${API_BASE}/tracking`)
        ])

        const [productResult, trackingResult] = await Promise.all([
          productResponse.json(),
          trackingResponse.json()
        ])

        if (!productResponse.ok || !trackingResponse.ok) {
          throw new Error('Unable to load header data')
        }

        if (active) {
          setProducts(productResult.data || [])
          setEvents(trackingResult.data || [])
        }
      } catch (error) {
        console.error('Header data error:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    const syncSettings = () => {
      setProfile(readLocal('tracefarm-profile', DEFAULT_PROFILE))
      setPreferences(readLocal('tracefarm-notifications', DEFAULT_PREFERENCES))
    }

    window.addEventListener('storage', syncSettings)
    window.addEventListener('focus', syncSettings)

    return () => {
      active = false
      window.removeEventListener('storage', syncSettings)
      window.removeEventListener('focus', syncSettings)
    }
  }, [])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []

    const productResults = products
      .filter(product => [
        product.batch_id,
        product.product_name,
        product.commodity,
        product.farmer_name,
        product.location,
        product.status
      ].join(' ').toLowerCase().includes(term))
      .map(product => ({
        type: 'product',
        id: product.batch_id,
        title: product.product_name || 'Unnamed Product',
        subtitle: `${product.batch_id} · ${product.farmer_name || 'Unknown farmer'}`,
        detail: `${product.commodity || '-'} · ${product.location || '-'}`
      }))

    const eventResults = events
      .filter(event => [
        event.batch_id,
        event.stage,
        event.status,
        event.location,
        event.description
      ].join(' ').toLowerCase().includes(term))
      .map(event => ({
        type: 'tracking',
        id: event.batch_id,
        title: event.stage || 'Tracking activity',
        subtitle: `${event.batch_id || '-'} · ${event.status || ''}`,
        detail: `${event.location || '-'} · ${event.description || ''}`
      }))

    return [...productResults, ...eventResults].slice(0, 10)
  }, [query, products, events])

  const notifications = useMemo(() => {
    const items = []

    if (preferences.products) {
      products
        .filter(product => String(product.status || '').toLowerCase() === 'pending')
        .forEach(product => {
          items.push({
            id: `product-${product.batch_id}`,
            type: 'product',
            title: 'Product awaiting verification',
            description: `${product.product_name || product.batch_id} · ${product.batch_id}`,
            page: 'Products'
          })
        })
    }

    if (preferences.verification) {
      products
        .filter(product => String(product.status || '').toLowerCase() === 'verified')
        .forEach(product => {
          items.push({
            id: `verified-${product.batch_id}`,
            type: 'verification',
            title: 'Verified product',
            description: `${product.product_name || product.batch_id} · ${product.batch_id}`,
            page: 'Verification'
          })
        })
    }

    if (preferences.tracking) {
      events.forEach((event, index) => {
        items.push({
          id: `tracking-${event.id || `${event.batch_id}-${event.stage}-${event.created_at || index}`}`,
          type: 'tracking',
          title: event.stage || 'Tracking update',
          description: `${event.batch_id || '-'} · ${event.location || event.status || 'Activity recorded'}`,
          page: 'Tracking'
        })
      })
    }

    return items.slice(0, 20)
  }, [products, events, preferences])

  const unreadCount = notifications.filter(item => !readIds.includes(item.id)).length

  function markAllRead() {
    const next = [...new Set([...readIds, ...notifications.map(item => item.id)])]
    setReadIds(next)
    localStorage.setItem('tracefarm-read-notifications', JSON.stringify(next))
  }

  function openResult(result) {
    setActivePage(result.type === 'product' ? 'Products' : 'Tracking')
    setQuery('')
    setSearchOpen(false)
  }

  function openNotification(item) {
    markAllRead()
    setActivePage(item.page)
    setNotificationOpen(false)
  }

  function goToSettings() {
    setActivePage('Settings')
    setProfileOpen(false)
    setNotificationOpen(false)
  }

  const initials = (profile.name || 'TraceFarm Admin')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('')

  return (
    <header className="header">
      <div className="header-search" style={{ position: 'relative' }}>
        <Search size={19} />
        <input
          type="text"
          value={query}
          placeholder="Search products, farmers, or transactions..."
          onChange={event => {
            setQuery(event.target.value)
            setSearchOpen(true)
            setNotificationOpen(false)
            setProfileOpen(false)
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setSearchOpen(false)
            if (event.key === 'Enter' && results.length) openResult(results[0])
          }}
        />

        {searchOpen && query.trim() && (
          <div className="header-dropdown search-dropdown">
            {loading ? (
              <p className="header-empty">Loading search data...</p>
            ) : results.length === 0 ? (
              <p className="header-empty">No results found for "{query}"</p>
            ) : results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                type="button"
                className="header-result"
                onClick={() => openResult(result)}
              >
                {result.type === 'product'
                  ? <Package size={18} />
                  : <Truck size={18} />}
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <small>{result.detail}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="header-right">
        <div className="header-menu-wrap">
          <button
            className={`notification-button ${notificationOpen ? 'selected' : ''}`}
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationOpen}
            onClick={() => {
              setNotificationOpen(value => !value)
              setProfileOpen(false)
              setSearchOpen(false)
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notificationOpen && (
            <div className="header-dropdown notification-dropdown">
              <div className="dropdown-heading">
                <div>
                  <strong>Notifications</strong>
                  <small>{unreadCount} unread updates</small>
                </div>
                <button type="button" onClick={markAllRead}>
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <p className="header-empty">
                    {loading ? 'Loading activity...' : 'No notifications available.'}
                  </p>
                ) : notifications.map(item => {
                  const isRead = readIds.includes(item.id)
                  const Icon = item.type === 'product'
                    ? Package
                    : item.type === 'verification'
                      ? ShieldCheck
                      : Truck

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`notification-item ${isRead ? 'read' : 'unread'}`}
                      onClick={() => openNotification(item)}
                    >
                      <span className="notification-icon">
                        <Icon size={17} />
                      </span>
                      <span className="notification-copy">
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                      {!isRead && <span className="unread-indicator" />}
                    </button>
                  )
                })}
              </div>
              <div className="dropdown-footer">
                Activity from your TraceFarm records
              </div>
            </div>
          )}
        </div>

        <div className="header-menu-wrap">
          <button
            type="button"
            className="profile profile-trigger"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen(value => !value)
              setNotificationOpen(false)
              setSearchOpen(false)
            }}
          >
            <div className="profile-avatar">{initials || 'TF'}</div>
            <div className="profile-info">
              <h4>{profile.name}</h4>
              <span>Administrator</span>
            </div>
            <ChevronDown size={17} />
          </button>

          {profileOpen && (
            <div className="header-dropdown profile-dropdown">
              <div className="profile-dropdown-info">
                <div className="profile-avatar">{initials || 'TF'}</div>
                <span>
                  <strong>{profile.name}</strong>
                  <small>{profile.email}</small>
                  <small>{profile.organization}</small>
                </span>
              </div>
              <button type="button" onClick={goToSettings}>
                <Settings size={16} />
                Account Settings
              </button>
              <div className="profile-dropdown-note">
                Demo administrator account
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
