
import { useState } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

const API_URL = `${API_BASE_URL}/products`
const STORAGE_KEY = 'tracefarm-products'

const COMMODITIES = [
  'Rice',
  'Coffee',
  'Cocoa',
  'Corn',
  'Honey',
  'Tea',
  'Coconut',
  'Palm Oil',
  'Chili',
  'Vegetables',
  'Fruits',
  'Cassava'
]

const INITIAL_FORM = {
  productName: '',
  commodity: 'Rice',
  farmerName: '',
  quantity: '',
  harvestDate: '',
  location: ''
}

function AddProduct() {
  const [formData, setFormData] = useState({ ...INITIAL_FORM })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  async function generateBatchId() {
    const response = await fetch(API_URL)

    if (!response.ok) {
      throw new Error('Unable to retrieve existing products.')
    }

    const result = await response.json()
    const databaseProducts = Array.isArray(result.data)
      ? result.data
      : []

    let legacyProducts = []

    try {
      const storedProducts = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      )

      legacyProducts = Array.isArray(storedProducts)
        ? storedProducts
        : []
    } catch {
      legacyProducts = []
    }

    const allIds = [
      ...databaseProducts.map(product => product.batch_id || product.batchId),
      ...legacyProducts.map(product => product.id || product.batchId)
    ]

    const numbers = allIds
      .map(id => {
        const match = String(id || '').match(/^TF(\d+)$/i)
        return match ? Number(match[1]) : 0
      })
      .filter(Number.isFinite)

    const nextNumber = Math.max(4, ...numbers) + 1

    return `TF${String(nextNumber).padStart(3, '0')}`
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (isSubmitting) return

    const productName = formData.productName.trim()
    const farmerName = formData.farmerName.trim()
    const location = formData.location.trim()
    const quantity = Number(formData.quantity)

    if (!productName || !farmerName || !location) {
      setMessage('Please complete all required fields.')
      setMessageType('error')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Quantity must be a number greater than zero.')
      setMessageType('error')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      const batchId = await generateBatchId()

      const newProduct = {
        batch_id: batchId,
        product_name: productName,
        commodity: formData.commodity,
        farmer_name: farmerName,
        quantity: `${quantity} kg`,
        harvest_date: formData.harvestDate,
        location,
        status: 'Pending'
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProduct)
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            'Batch ID already exists. Please try registering again.'
          )
        }

        throw new Error(
          result.message || 'Failed to register product.'
        )
      }

      setMessage(
        `Product ${batchId} registered successfully in PostgreSQL!`
      )
      setMessageType('success')
      setFormData({ ...INITIAL_FORM })
    } catch (error) {
      console.error('Register product error:', error)

      setMessage(
        error.message || 'Unable to save product. Please try again.'
      )
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-content add-product-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">PRODUCT MANAGEMENT</span>
          <h1>Add New Product</h1>
          <p>Register a new agricultural product in TraceFarm.</p>
        </div>
      </div>

      <div className="product-form-card">
        <div className="form-card-header">
          <h2>Product Information</h2>
          <p>Fill in the details below to register a new product.</p>
        </div>

        {message && (
          <div
            className={`settings-message ${messageType}`}
            role="status"
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="product-form-grid">
            <div className="form-group">
              <label htmlFor="productName">Product Name</label>
              <input
                id="productName"
                type="text"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="commodity">Commodity</label>
              <select
                id="commodity"
                name="commodity"
                value={formData.commodity}
                onChange={handleChange}
                required
              >
                {COMMODITIES.map(commodity => (
                  <option key={commodity} value={commodity}>
                    {commodity}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="farmerName">Farmer Name</label>
              <input
                id="farmerName"
                type="text"
                name="farmerName"
                value={formData.farmerName}
                onChange={handleChange}
                placeholder="Enter farmer name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Quantity (kg)</label>
              <input
                id="quantity"
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="Enter quantity"
                min="0.01"
                step="any"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="harvestDate">Harvest Date</label>
              <input
                id="harvestDate"
                type="date"
                name="harvestDate"
                value={formData.harvestDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Farm Location</label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter farm location"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="register-product-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddProduct
