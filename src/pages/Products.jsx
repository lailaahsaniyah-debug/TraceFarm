
import { useCallback, useEffect, useState } from 'react'

import {
  Package,
  Search,
  Plus,
  Eye,
  ShieldCheck,
  Clock,
  Pencil,
  Trash2,
  X,
  MapPin,
  CalendarDays,
  User,
  RefreshCw
} from 'lucide-react'

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

const API_URL = `${API_BASE_URL}/products`

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

function formatDatabaseProduct(product) {
  return {
    id: product.batch_id || product.batchId,
    name: product.product_name || product.productName || 'Unnamed Product',
    category: product.commodity || '-',
    farmer: product.farmer_name || product.farmerName || '-',
    quantity: product.quantity ?? '',
    status: product.status || 'Pending',
    harvestDate: product.harvest_date || product.harvestDate
      ? String(product.harvest_date || product.harvestDate).slice(0, 10)
      : '',
    location: product.location || ''
  }
}

function formatQuantity(quantity) {
  if (quantity === null || quantity === undefined || quantity === '') {
    return '-'
  }

  const value = String(quantity).trim()

  return /\bkg\b/i.test(value) ? value : `${value} kg`
}

function formatDate(date) {
  if (!date) return '-'

  const parsedDate = new Date(`${String(date).slice(0, 10)}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) return '-'

  return parsedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

async function readResponse(response) {
  let result

  try {
    result = await response.json()
  } catch {
    throw new Error('Invalid response from server.')
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Request failed.')
  }

  return result
}

function Products({ setActivePage }) {
  const [products, setProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deletingProduct, setDeletingProduct] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch(API_URL)
      const result = await readResponse(response)

      const databaseProducts = Array.isArray(result.data)
        ? result.data
        : []

      setProducts(databaseProducts.map(formatDatabaseProduct))
    } catch (error) {
      console.error('Load products error:', error)

      setMessage(
        error.message || 'Unable to load products from PostgreSQL.'
      )
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()

    function handleFocus() {
      loadProducts()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadProducts])

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.toLowerCase()

    return (
      String(product.name).toLowerCase().includes(search) ||
      String(product.id).toLowerCase().includes(search) ||
      String(product.category).toLowerCase().includes(search) ||
      String(product.farmer).toLowerCase().includes(search)
    )
  })

  function openAddProduct() {
    setActivePage?.('Add Product')
  }

  function handleEditChange(field, value) {
    setEditingProduct(previous => ({
      ...previous,
      [field]: value
    }))
  }

  function openEditProduct(product) {
    if (product.status.toLowerCase() === 'verified') {
      setMessage(
        'Verified products cannot be edited directly. Their verification and blockchain audit must remain consistent.'
      )
      setMessageType('error')
      return
    }

    setEditingProduct({
      ...product,
      quantity: String(product.quantity).replace(/\s*kg\s*$/i, '')
    })
  }

  function openDeleteProduct(product) {
    if (product.status.toLowerCase() === 'verified') {
      setMessage(
        'Verified products cannot be deleted directly because their audit and blockchain proof must be preserved.'
      )
      setMessageType('error')
      return
    }

    setDeletingProduct(product)
  }

  async function handleSaveEdit(event) {
    event.preventDefault()

    if (!editingProduct) return

    const quantity = Number(editingProduct.quantity)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Quantity must be greater than zero.')
      setMessageType('error')
      return
    }

    if (!editingProduct.name.trim() || !editingProduct.farmer.trim()) {
      setMessage('Product name and farmer name are required.')
      setMessageType('error')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(
        `${API_URL}/${encodeURIComponent(editingProduct.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_name: editingProduct.name.trim(),
            commodity: editingProduct.category,
            farmer_name: editingProduct.farmer.trim(),
            quantity,
            harvest_date: editingProduct.harvestDate || null,
            location: editingProduct.location.trim()
          })
        }
      )

      await readResponse(response)

      setEditingProduct(null)
      setMessage('Product updated successfully in PostgreSQL!')
      setMessageType('success')

      await loadProducts()
    } catch (error) {
      console.error('Update product error:', error)
      setMessage(error.message || 'Unable to update product.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingProduct) return

    try {
      setSaving(true)

      const response = await fetch(
        `${API_URL}/${encodeURIComponent(deletingProduct.id)}`,
        {
          method: 'DELETE'
        }
      )

      await readResponse(response)

      setDeletingProduct(null)
      setSelectedProduct(null)
      setMessage('Product deleted successfully from PostgreSQL!')
      setMessageType('success')

      await loadProducts()
    } catch (error) {
      console.error('Delete product error:', error)
      setMessage(error.message || 'Unable to delete product.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  function getStatusClass(status) {
    const normalizedStatus = String(status).toLowerCase()

    if (normalizedStatus === 'verified') return 'verified'
    if (normalizedStatus === 'rejected') return 'rejected'

    return 'pending'
  }

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="welcome-text">PRODUCT MANAGEMENT</p>
          <h1>Products</h1>
          <p className="page-description">
            Manage and monitor your registered agricultural products.
          </p>
        </div>

        <button className="primary-button" onClick={openAddProduct}>
          <Plus size={18} />
          Add Product
        </button>
      </div>

      {message && (
        <div
          className={`settings-message ${messageType}`}
          role="status"
        >
          {message}

          <button
            onClick={() => setMessage('')}
            aria-label="Close message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="content-card products-card">
        <div className="products-toolbar">
          <div>
            <h2>All Products</h2>
            <p>
              {loading
                ? 'Loading products...'
                : `${products.length} products registered in PostgreSQL`}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            <button
              className="icon-button"
              onClick={loadProducts}
              disabled={loading}
              title="Refresh products"
            >
              <RefreshCw size={17} />
            </button>

            <div className="product-search">
              <Search size={18} />

              <input
                placeholder="Search products..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Farmer</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-products">
                    Loading products from PostgreSQL...
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map(product => {
                  const isVerified =
                    product.status.toLowerCase() === 'verified'

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name">
                          <div className="product-icon">
                            <Package size={19} />
                          </div>

                          <div>
                            <strong>{product.name}</strong>
                            <span>
                              {product.id} · {product.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{product.farmer}</td>

                      <td>{formatQuantity(product.quantity)}</td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(product.status)}`}
                        >
                          {isVerified
                            ? <ShieldCheck size={14} />
                            : <Clock size={14} />}

                          {product.status}
                        </span>
                      </td>

                      <td>
                        <div className="product-actions">
                          <button
                            className="icon-button"
                            title="View product"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            className="icon-button"
                            title={
                              isVerified
                                ? 'Verified product cannot be edited'
                                : 'Edit product'
                            }
                            onClick={() => openEditProduct(product)}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            className="icon-button delete-action"
                            title={
                              isVerified
                                ? 'Verified product cannot be deleted'
                                : 'Delete product'
                            }
                            onClick={() => openDeleteProduct(product)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="5" className="empty-products">
                    {products.length === 0
                      ? 'No products registered in PostgreSQL yet.'
                      : 'No products found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProduct && (
        <div
          className="product-modal-overlay"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="product-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="product-modal-header">
              <div>
                <span className="welcome-text">PRODUCT DETAILS</span>
                <h2>{selectedProduct.name}</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setSelectedProduct(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="product-detail-list">
              <p>
                <Package size={17} />
                <strong>Batch ID:</strong> {selectedProduct.id}
              </p>

              <p>
                <User size={17} />
                <strong>Farmer:</strong> {selectedProduct.farmer}
              </p>

              <p>
                <Package size={17} />
                <strong>Commodity:</strong> {selectedProduct.category}
              </p>

              <p>
                <Package size={17} />
                <strong>Quantity:</strong> {formatQuantity(selectedProduct.quantity)}
              </p>

              <p>
                <CalendarDays size={17} />
                <strong>Harvest:</strong> {formatDate(selectedProduct.harvestDate)}
              </p>

              <p>
                <MapPin size={17} />
                <strong>Location:</strong> {selectedProduct.location || '-'}
              </p>

              <p>
                <ShieldCheck size={17} />
                <strong>Status:</strong> {selectedProduct.status}
              </p>
            </div>

            <button
              className="primary-button modal-full-button"
              onClick={() => setSelectedProduct(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {editingProduct && (
        <div
          className="product-modal-overlay"
          onClick={() => !saving && setEditingProduct(null)}
        >
          <div
            className="product-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="product-modal-header">
              <div>
                <span className="welcome-text">PRODUCT MANAGEMENT</span>
                <h2>Edit Product</h2>
              </div>

              <button
                className="icon-button"
                disabled={saving}
                onClick={() => setEditingProduct(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="product-edit-form" onSubmit={handleSaveEdit}>
              <label>
                Product Name
                <input
                  required
                  value={editingProduct.name}
                  onChange={event =>
                    handleEditChange('name', event.target.value)
                  }
                />
              </label>

              <label>
                Commodity
                <select
                  value={editingProduct.category}
                  onChange={event =>
                    handleEditChange('category', event.target.value)
                  }
                >
                  {!COMMODITIES.includes(editingProduct.category) && (
                    <option value={editingProduct.category}>
                      {editingProduct.category}
                    </option>
                  )}

                  {COMMODITIES.map(commodity => (
                    <option key={commodity} value={commodity}>
                      {commodity}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Farmer Name
                <input
                  required
                  value={editingProduct.farmer}
                  onChange={event =>
                    handleEditChange('farmer', event.target.value)
                  }
                />
              </label>

              <label>
                Quantity (kg)
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={editingProduct.quantity}
                  onChange={event =>
                    handleEditChange('quantity', event.target.value)
                  }
                />
              </label>

              <label>
                Harvest Date
                <input
                  type="date"
                  value={editingProduct.harvestDate || ''}
                  onChange={event =>
                    handleEditChange('harvestDate', event.target.value)
                  }
                />
              </label>

              <label>
                Farm Location
                <input
                  value={editingProduct.location || ''}
                  onChange={event =>
                    handleEditChange('location', event.target.value)
                  }
                />
              </label>

              <div className="product-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div
          className="product-modal-overlay"
          onClick={() => !saving && setDeletingProduct(null)}
        >
          <div
            className="product-modal delete-confirm-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="product-modal-header">
              <div>
                <span className="welcome-text">DELETE PRODUCT</span>
                <h2>Are you sure?</h2>
              </div>

              <button
                className="icon-button"
                disabled={saving}
                onClick={() => setDeletingProduct(null)}
              >
                <X size={20} />
              </button>
            </div>

            <p>
              Delete <strong>{deletingProduct.name}</strong> ({deletingProduct.id})?
              This action cannot be undone.
            </p>

            <p>
              Its associated tracking events and verification history may
              also be deleted depending on the database relationships.
              Any existing blockchain transaction will remain on-chain.
            </p>

            <div className="product-modal-actions">
              <button
                className="secondary-button"
                disabled={saving}
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </button>

              <button
                className="delete-confirm-button"
                disabled={saving}
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                {saving ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
