
import { useEffect, useMemo, useState } from 'react'
import { Search, Bell, ChevronDown, Package, Truck } from 'lucide-react'

const API_BASE = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

function Header({ setActivePage }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSearchData() {
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
          throw new Error('Unable to load search data')
        }

        if (active) {
          setProducts(productResult.data || [])
          setEvents(trackingResult.data || [])
        }
      } catch (error) {
        console.error('Search data error:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSearchData()

    return () => {
      active = false
    }
  }, [])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []

    const productResults = products
      .filter(product => {
        const searchable = [
          product.batch_id,
          product.product_name,
          product.commodity,
          product.farmer_name,
          product.location,
          product.status
        ].join(' ').toLowerCase()

        return searchable.includes(term)
      })
      .map(product => ({
        type: 'product',
        id: product.batch_id,
        title: product.product_name || 'Unnamed Product',
        subtitle: `${product.batch_id} · ${product.farmer_name || 'Unknown farmer'}`,
        detail: `${product.commodity || '-'} · ${product.location || '-'}`,
        icon: 'product'
      }))

    const eventResults = events
      .filter(event => {
        const searchable = [
          event.batch_id,
          event.stage,
          event.status,
          event.location,
          event.description
        ].join(' ').toLowerCase()

        return searchable.includes(term)
      })
      .map(event => ({
        type: 'tracking',
        id: event.batch_id,
        title: event.stage || 'Tracking activity',
        subtitle: `${event.batch_id || '-'} · ${event.status || ''}`,
        detail: `${event.location || '-'} · ${event.description || ''}`,
        icon: 'tracking'
      }))

    return [...productResults, ...eventResults].slice(0, 10)
  }, [query, products, events])

  function openResult(result) {
    setActivePage(result.type === 'product' ? 'Products' : 'Tracking')
    setQuery('')
    setOpen(false)
  }

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
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'Enter' && results.length > 0) {
              openResult(results[0])
            }
          }}
        />

        {open && query.trim() && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              left: 0,
              right: 0,
              minWidth: '320px',
              maxHeight: '420px',
              overflowY: 'auto',
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
              zIndex: 1000,
              padding: '8px'
            }}
          >
            {loading ? (
              <p style={{ padding: '12px', fontSize: '13px' }}>
                Loading search data...
              </p>
            ) : results.length === 0 ? (
              <p style={{ padding: '12px', fontSize: '13px' }}>
                No results found for "{query}"
              </p>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  type="button"
                  onClick={() => openResult(result)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    width: '100%',
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={event => {
                    event.currentTarget.style.background =
                      'var(--hover-bg, #f3f4f6)'
                  }}
                  onMouseLeave={event => {
                    event.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ paddingTop: '2px' }}>
                    {result.icon === 'product'
                      ? <Package size={18} />
                      : <Truck size={18} />}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '13px' }}>
                      {result.title}
                    </strong>
                    <span style={{
                      display: 'block',
                      fontSize: '12px',
                      opacity: 0.75,
                      marginTop: '3px'
                    }}>
                      {result.subtitle}
                    </span>
                    <span style={{
                      display: 'block',
                      fontSize: '11px',
                      opacity: 0.65,
                      marginTop: '3px'
                    }}>
                      {result.detail}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        <button className="notification-button" type="button">
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

      {open && (
        <button
          type="button"
          aria-label="Close search results"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none'
          }}
        />
      )}
    </header>
  )
}

export default Header
