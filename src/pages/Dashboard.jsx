
import { useCallback, useEffect, useState } from 'react'

import {
  Package,
  Users,
  ShieldCheck,
  Sprout,
  ArrowUpRight,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

import StatCard from '../components/StatCard'

// Gunakan backend pada domain yang sama dengan frontend.
const API_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

const COMMODITIES = [
  { name: 'Rice', category: 'Grains' },
  { name: 'Coffee', category: 'Plantation' },
  { name: 'Cocoa', category: 'Plantation' },
  { name: 'Corn', category: 'Grains' },
  { name: 'Honey', category: 'Apiculture' },
  { name: 'Tea', category: 'Plantation' },
  { name: 'Coconut', category: 'Plantation' },
  { name: 'Palm Oil', category: 'Plantation' },
  { name: 'Chili', category: 'Horticulture' },
  { name: 'Vegetables', category: 'Horticulture' },
  { name: 'Fruits', category: 'Horticulture' },
  { name: 'Cassava', category: 'Root Crops' }
]

const commodityColors = [
  '#E9B94E',
  '#966447',
  '#8B69B5',
  '#D69A35',
  '#4387B8',
  '#3B8250',
  '#C47B54',
  '#5B9B8A',
  '#A78B55',
  '#7295B8',
  '#B47C9D',
  '#829B45'
]

async function fetchJSON(url) {
  const response = await fetch(url)

  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('Invalid response from server.')
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed (${response.status})`
    )
  }

  return result
}

function getArray(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.products)) return result.products
  if (Array.isArray(result?.history)) return result.history

  return []
}

function getDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatActivityDate(value) {
  const date = getDate(value)

  if (!date) return 'Date unavailable'

  const today = new Date()
  const yesterday = new Date()

  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a, b) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()

  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (sameDay(date, today)) return `Today, ${time}`
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function Dashboard({ setActivePage }) {
  const [products, setProducts] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailWarning, setDetailWarning] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    setDetailWarning('')

    try {
      // Produk adalah sumber utama statistik dashboard.
      const productResponse = await fetchJSON(
        `${API_URL}/products`
      )

      const productList = getArray(productResponse)
      setProducts(productList)

      // Ambil tracking dan verification tanpa menggagalkan
      // statistik utama jika salah satu endpoint bermasalah.
      const detailResults = await Promise.allSettled(
        productList.map(async (product) => {
          const batchId = product.batch_id || product.batchId

          if (!batchId) {
            return {
              product,
              tracking: [],
              verification: [],
              failed: true
            }
          }

          const [trackingResult, verificationResult] =
            await Promise.allSettled([
              fetchJSON(
                `${API_URL}/tracking/${encodeURIComponent(batchId)}`
              ),
              fetchJSON(
                `${API_URL}/verification/${encodeURIComponent(batchId)}`
              )
            ])

          const verificationData =
            verificationResult.status === 'fulfilled'
              ? verificationResult.value
              : null

          const verificationHistory =
            verificationData?.history ||
            verificationData?.data?.history ||
            verificationData?.data?.verification_history ||
            verificationData?.verification_history ||
            []

          return {
            product,
            tracking:
              trackingResult.status === 'fulfilled'
                ? getArray(trackingResult.value)
                : [],
            verification: Array.isArray(verificationHistory)
              ? verificationHistory
              : [],
            failed:
              trackingResult.status === 'rejected' ||
              verificationResult.status === 'rejected'
          }
        })
      )

      const activityItems = []
      let failedDetailRequests = 0

      detailResults.forEach((result) => {
        if (result.status !== 'fulfilled') {
          failedDetailRequests += 1
          return
        }

        const {
          product,
          tracking,
          verification,
          failed
        } = result.value

        if (failed) failedDetailRequests += 1

        const productName =
          product.product_name ||
          product.productName ||
          'Unnamed Product'

        const batchId =
          product.batch_id ||
          product.batchId ||
          'Unknown'

        if (product.created_at || product.createdAt) {
          activityItems.push({
            id: `product-${batchId}`,
            title: 'New product registered',
            description: `${productName} - Batch #${batchId}`,
            date: product.created_at || product.createdAt,
            color: 'green'
          })
        }

        tracking.forEach((event, index) => {
          activityItems.push({
            id: `tracking-${event.id || `${batchId}-${index}`}`,
            title: `Tracking updated: ${event.stage || 'New event'}`,
            description: `${productName} - Batch #${batchId}`,
            date:
              event.created_at ||
              event.createdAt ||
              event.event_date ||
              event.eventDate,
            color: 'yellow'
          })
        })

        verification.forEach((record, index) => {
          const decision =
            record.decision ||
            record.new_status ||
            record.newStatus

          activityItems.push({
            id: `verification-${record.id || record.audit_id || `${batchId}-${index}`}`,
            title:
              decision === 'Verified'
                ? 'Product verified'
                : decision === 'Rejected'
                  ? 'Product rejected'
                  : 'Verification updated',
            description: `${productName} - Batch #${batchId}`,
            date:
              record.verified_at ||
              record.verifiedAt ||
              record.created_at ||
              record.createdAt,
            color:
              decision === 'Verified' ? 'blue' : 'yellow'
          })
        })
      })

      activityItems.sort((a, b) => {
        return (
          (getDate(b.date)?.getTime() || 0) -
          (getDate(a.date)?.getTime() || 0)
        )
      })

      setActivities(activityItems.slice(0, 5))

      if (failedDetailRequests > 0) {
        setDetailWarning(
          'Some tracking or verification records could not be loaded. Product statistics are still available.'
        )
      }
    } catch (err) {
      console.error('Dashboard loading error:', err)

      setError(
        err.message || 'Unable to load dashboard data.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const totalProducts = products.length

  const registeredFarmers = new Set(
    products
      .map((product) =>
        (
          product.farmer_name ||
          product.farmerName ||
          ''
        ).trim().toLowerCase()
      )
      .filter(Boolean)
  ).size

  const verifiedProducts = products.filter(
    (product) =>
      (product.status || '').toLowerCase() === 'verified'
  ).length

  const commodityGroups = products.reduce((groups, product) => {
    const name = (product.commodity || '')
      .trim()
      .toLowerCase()

    if (!name) return groups

    groups[name] = (groups[name] || 0) + 1

    return groups
  }, {})

  const commodities = COMMODITIES.map((commodity, index) => ({
    ...commodity,
    products:
      commodityGroups[commodity.name.toLowerCase()] || 0,
    color: commodityColors[index]
  })).sort((a, b) => {
    if (b.products !== a.products) {
      return b.products - a.products
    }

    return (
      COMMODITIES.findIndex(
        (item) => item.name === a.name
      ) -
      COMMODITIES.findIndex(
        (item) => item.name === b.name
      )
    )
  })

  const statistics = [
    {
      title: 'Total Products',
      value: loading ? '...' : totalProducts,
      description: 'Products registered',
      icon: Package,
      color: '#3B8250'
    },
    {
      title: 'Registered Farmers',
      value: loading ? '...' : registeredFarmers,
      description: 'Unique farmers on platform',
      icon: Users,
      color: '#D69A35'
    },
    {
      title: 'Verified Products',
      value: loading ? '...' : verifiedProducts,
      description: 'Successfully verified',
      icon: ShieldCheck,
      color: '#4387B8'
    },
    {
      title: 'Commodities',
      value: loading ? '...' : COMMODITIES.length,
      description: 'Available agricultural categories',
      icon: Sprout,
      color: '#8B69B5'
    }
  ]

  const currentMonth = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="welcome-text">
            WELCOME BACK, ADMIN!
          </p>

          <h1>Dashboard Overview</h1>

          <p className="page-description">
            Monitor your agricultural supply chain in one place.
          </p>
        </div>

        <button
          className="date-button"
          onClick={loadDashboard}
          disabled={loading}
          title="Refresh dashboard"
        >
          <RefreshCw
            size={15}
            style={{
              marginRight: '8px',
              verticalAlign: 'middle'
            }}
          />

          {currentMonth}
        </button>
      </div>

      {error && (
        <div
          className="content-card"
          style={{ marginBottom: '20px' }}
        >
          <p style={{ color: '#c0392b', marginBottom: '10px' }}>
            {error}
          </p>

          <button
            className="text-button"
            onClick={loadDashboard}
          >
            Try again <RefreshCw size={15} />
          </button>
        </div>
      )}

      {detailWarning && !error && (
        <div
          className="content-card"
          style={{ marginBottom: '20px' }}
        >
          <p style={{ color: '#946200', margin: 0 }}>
            {detailWarning}
          </p>
        </div>
      )}

      <div className="statistics-grid">
        {statistics.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="content-card commodity-card">
          <div className="section-heading">
            <div>
              <h2>All 12 Commodities</h2>
              <p>
                Registered products across agricultural categories
              </p>
            </div>

            <button
              className="text-button"
              onClick={() => setActivePage?.('Products')}
              disabled={!setActivePage}
            >
              View all <ArrowRight size={16} />
            </button>
          </div>

          <div className="commodity-list">
            {loading ? (
              <p>Loading commodities...</p>
            ) : (
              commodities.map((item) => (
                <div
                  className="commodity-item"
                  key={item.name}
                >
                  <div
                    className="commodity-icon"
                    style={{
                      backgroundColor: `${item.color}18`,
                      color: item.color
                    }}
                  >
                    <Sprout size={22} />
                  </div>

                  <div className="commodity-info">
                    <h3>{item.name}</h3>
                    <span>{item.category}</span>
                  </div>

                  <div className="commodity-count">
                    <strong>{item.products}</strong>
                    <span>Products</span>
                  </div>

                  <ArrowUpRight
                    size={18}
                    className="commodity-arrow"
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="content-card activity-card">
          <div className="section-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest platform updates</p>
            </div>
          </div>

          <div className="activity-list">
            {loading ? (
              <p>Loading recent activity...</p>
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  className="activity-item"
                  key={activity.id}
                >
                  <div
                    className={`activity-dot ${activity.color}`}
                  ></div>

                  <div>
                    <h3>{activity.title}</h3>
                    <p>{activity.description}</p>
                    <span>
                      {formatActivityDate(activity.date)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p>No recent activity available.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
