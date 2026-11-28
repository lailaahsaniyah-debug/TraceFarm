
import { useEffect, useState } from 'react'

const API_BASE = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

const STAGES = [
  'Harvest',
  'Processing',
  'Packaging',
  'Distribution',
  'Delivery'
]

function getToday() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const dateString = String(value).slice(0, 10)
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

async function readResponse(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.message || `Request failed (${response.status})`)
  }
  return result
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const dateCompare = String(a.event_date || '').localeCompare(
      String(b.event_date || '')
    )
    return dateCompare || Number(a.id || 0) - Number(b.id || 0)
  })
}

const styles = {
  page: {
    padding: '24px',
    color: 'var(--text-primary, #1f2937)',
    width: '100%',
    boxSizing: 'border-box'
  },
  heading: { margin: '0 0 8px', fontSize: '26px', fontWeight: 700 },
  subtitle: {
    margin: '0 0 24px',
    color: 'var(--text-secondary, #6b7280)',
    fontSize: '14px'
  },
  card: {
    background: 'var(--card-bg, #ffffff)',
    border: '1px solid var(--border-color, #e5e7eb)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px'
  },
  sectionTitle: { fontSize: '17px', fontWeight: 700, margin: '0 0 16px' },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '7px'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--input-bg, #ffffff)',
    color: 'inherit'
  },
  button: {
    padding: '11px 18px',
    border: 'none',
    borderRadius: '8px',
    background: '#16845b',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer'
  },
  muted: { color: 'var(--text-secondary, #6b7280)', fontSize: '13px' }
}

function Tracking() {
  const [products, setProducts] = useState([])
  const [selectedBatch, setSelectedBatch] = useState('')
  const [trackingData, setTrackingData] = useState([])
  const [formData, setFormData] = useState({
    stage: 'Harvest',
    date: getToday(),
    location: '',
    description: '',
    status: 'Completed'
  })

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setLoadingProducts(true)
      try {
        const response = await fetch(`${API_BASE}/products`)
        const result = await readResponse(response)

        const data = (result.data || []).map(product => ({
          id: product.batch_id || product.batchId,
          productName: product.product_name || product.productName,
          commodity: product.commodity || 'Other',
          farmerName: product.farmer_name || product.farmerName || 'Unknown farmer',
          quantity: product.quantity || '-',
          location: product.location || 'Location not provided',
          status: product.status || 'Pending'
        })).filter(product => product.id)

        if (cancelled) return
        setProducts(data)
        setSelectedBatch(current =>
          data.some(product => product.id === current)
            ? current
            : data[0]?.id || ''
        )
        setMessage(data.length ? '' : 'No products found. Register a product first.')
        setMessageType(data.length ? 'success' : 'error')
      } catch (error) {
        if (!cancelled) {
          console.error('Load products error:', error)
          setMessage(error.message || 'Unable to load products.')
          setMessageType('error')
        }
      } finally {
        if (!cancelled) setLoadingProducts(false)
      }
    }

    loadProducts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadTracking() {
      if (!selectedBatch) {
        setTrackingData([])
        setLoadingTracking(false)
        return
      }

      setLoadingTracking(true)
      setTrackingData([])
      setMessage('')

      try {
        const response = await fetch(
          `${API_BASE}/tracking/${encodeURIComponent(selectedBatch)}`
        )
        const result = await readResponse(response)

        if (!cancelled) {
          setTrackingData(sortEvents(Array.isArray(result.data) ? result.data : []))
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Load tracking error:', error)
          setTrackingData([])
          setMessage(error.message || 'Unable to load tracking history.')
          setMessageType('error')
        }
      } finally {
        if (!cancelled) setLoadingTracking(false)
      }
    }

    loadTracking()
    return () => { cancelled = true }
  }, [selectedBatch])

  function handleChange(event) {
    const { name, value } = event.target
    setFormData(previous => ({ ...previous, [name]: value }))
  }

  async function handleAddEvent(event) {
    event.preventDefault()
    if (!selectedBatch || isSaving) return

    if (!formData.location.trim() || !formData.description.trim()) {
      setMessage('Please complete the location and description.')
      setMessageType('error')
      return
    }

    setIsSaving(true)
    setMessage('')

    try {
      const response = await fetch(
        `${API_BASE}/tracking/${encodeURIComponent(selectedBatch)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            location: formData.location.trim(),
            description: formData.description.trim()
          })
        }
      )

      const result = await readResponse(response)

      // Reload from PostgreSQL so the screen reflects saved data.
      const historyResponse = await fetch(
        `${API_BASE}/tracking/${encodeURIComponent(selectedBatch)}`
      )
      const history = await readResponse(historyResponse)

      setTrackingData(sortEvents(Array.isArray(history.data) ? history.data : []))
      setFormData({
        stage: 'Harvest',
        date: getToday(),
        location: '',
        description: '',
        status: 'Completed'
      })
      setShowForm(false)
      setMessage(result.message || 'Tracking event saved successfully.')
      setMessageType('success')
    } catch (error) {
      console.error('Save tracking event error:', error)
      setMessage(error.message || 'Unable to save tracking event.')
      setMessageType('error')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedProduct = products.find(product => product.id === selectedBatch)

  const completedStages = new Set(
    trackingData.filter(event => event.status === 'Completed').map(event => event.stage)
  )
  const activeStages = new Set(
    trackingData.filter(event => event.status === 'In Progress').map(event => event.stage)
  )

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={styles.heading}>Product Tracking</h1>
        <p style={styles.subtitle}>
          Monitor product movement and record every stage of the supply chain.
        </p>
      </div>

      {message && (
        <div role="alert" style={{
          padding: '12px 15px',
          borderRadius: '8px',
          marginBottom: '18px',
          fontSize: '14px',
          background: messageType === 'error' ? '#fee2e2' : '#dcfce7',
          color: messageType === 'error' ? '#991b1b' : '#166534'
        }}>
          {message}
        </div>
      )}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Select Product</h2>
        {loadingProducts ? (
          <p style={styles.muted}>Loading products from database...</p>
        ) : products.length === 0 ? (
          <p style={styles.muted}>No products found in PostgreSQL. Register a product first.</p>
        ) : (
          <>
            <label htmlFor="tracking-product" style={styles.label}>Product / Batch ID</label>
            <select id="tracking-product" value={selectedBatch}
              onChange={event => {
                setSelectedBatch(event.target.value)
                setShowForm(false)
                setMessage('')
              }} style={styles.input}>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.id} — {product.productName}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      {selectedProduct && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Product Overview</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '20px'
          }}>
            {[
              ['Product Name', selectedProduct.productName],
              ['Batch ID', selectedProduct.id],
              ['Commodity', selectedProduct.commodity],
              ['Farmer', selectedProduct.farmerName],
              ['Quantity', selectedProduct.quantity],
              ['Current Status', selectedProduct.status]
            ].map(([label, value]) => (
              <div key={label}>
                <p style={styles.muted}>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={styles.card}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ ...styles.sectionTitle, marginBottom: '5px' }}>Product Journey</h2>
            <p style={styles.muted}>{trackingData.length} tracking event(s) recorded</p>
          </div>
          <button type="button" style={styles.button}
            disabled={!selectedProduct || loadingProducts}
            onClick={() => {
              setShowForm(previous => !previous)
              setMessage('')
            }}>
            {showForm ? 'Cancel' : '+ Add Tracking Event'}
          </button>
        </div>

        {showForm && selectedProduct && (
          <form onSubmit={handleAddEvent} style={{
            padding: '18px',
            borderRadius: '10px',
            background: 'var(--secondary-bg, #f9fafb)',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '16px' }}>New Tracking Event</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px'
            }}>
              <div>
                <label htmlFor="event-stage" style={styles.label}>Stage</label>
                <select id="event-stage" name="stage" value={formData.stage}
                  onChange={handleChange} required style={styles.input}>
                  {STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="event-date" style={styles.label}>Date</label>
                <input id="event-date" type="date" name="date"
                  value={formData.date} onChange={handleChange} required style={styles.input} />
              </div>
              <div>
                <label htmlFor="event-location" style={styles.label}>Location</label>
                <input id="event-location" type="text" name="location"
                  value={formData.location} onChange={handleChange}
                  placeholder="Enter event location" required style={styles.input} />
              </div>
              <div>
                <label htmlFor="event-status" style={styles.label}>Status</label>
                <select id="event-status" name="status" value={formData.status}
                  onChange={handleChange} style={styles.input}>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '15px' }}>
              <label htmlFor="event-description" style={styles.label}>Description</label>
              <textarea id="event-description" name="description"
                value={formData.description} onChange={handleChange}
                placeholder="Describe what happened at this stage..."
                rows={3} required
                style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <button type="submit" disabled={isSaving}
              style={{ ...styles.button, marginTop: '15px', opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? 'Saving...' : 'Save Tracking Event'}
            </button>
          </form>
        )}

        {loadingTracking ? (
          <p style={styles.muted}>Loading tracking history...</p>
        ) : !selectedProduct ? (
          <p style={styles.muted}>Select a product to view its tracking history.</p>
        ) : trackingData.length === 0 ? (
          <div style={{
            padding: '30px 15px',
            textAlign: 'center',
            border: '1px dashed #d1d5db',
            borderRadius: '10px'
          }}>
            <p style={{ fontWeight: 600, margin: '0 0 8px' }}>No tracking events yet</p>
            <p style={styles.muted}>Add the first event to start recording this product's journey.</p>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '8px' }}>
            {trackingData.map((event, index) => (
              <div key={event.id} style={{
                display: 'flex',
                gap: '15px',
                position: 'relative',
                paddingBottom: index === trackingData.length - 1 ? '0' : '26px'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: event.status === 'Completed'
                      ? '#16845b'
                      : event.status === 'In Progress' ? '#3b82f6' : '#f59e0b',
                    border: '3px solid #dcfce7',
                    boxSizing: 'content-box'
                  }} />
                  {index !== trackingData.length - 1 && (
                    <div style={{
                      width: '2px',
                      flex: 1,
                      minHeight: '45px',
                      background: '#d1d5db'
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, marginTop: '-3px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '9px',
                    marginBottom: '6px'
                  }}>
                    <strong>{event.stage}</strong>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '20px',
                      background: event.status === 'Completed'
                        ? '#dcfce7'
                        : event.status === 'In Progress' ? '#dbeafe' : '#fef3c7',
                      color: event.status === 'Completed'
                        ? '#166534'
                        : event.status === 'In Progress' ? '#1d4ed8' : '#92400e'
                    }}>
                      {event.status || 'Completed'}
                    </span>
                  </div>
                  <p style={{ ...styles.muted, margin: '0 0 5px' }}>
                    {formatDate(event.event_date)} · {event.location}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Supply Chain Stages</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {STAGES.map((stage, index) => {
            const completed = completedStages.has(stage)
            const active = activeStages.has(stage)
            return (
              <div key={stage} style={{
                flex: '1 1 130px',
                padding: '13px',
                borderRadius: '9px',
                background: completed ? '#dcfce7' : active ? '#dbeafe' : '#f3f4f6',
                color: completed ? '#166534' : active ? '#1d4ed8' : '#6b7280'
              }}>
                <div style={{ fontSize: '12px', marginBottom: '5px' }}>Stage {index + 1}</div>
                <strong style={{ fontSize: '13px' }}>
                  {completed ? '✓ ' : active ? '● ' : ''}{stage}
                </strong>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default Tracking
