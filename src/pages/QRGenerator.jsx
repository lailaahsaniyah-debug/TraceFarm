
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'

const API_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

function QRGenerator() {
  const [products, setProducts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/products`)
      let result

      try {
        result = await response.json()
      } catch {
        throw new Error('Invalid response from server.')
      }

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || `Unable to load products (${response.status}).`
        )
      }

      const databaseProducts = Array.isArray(result)
        ? result
        : Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.products)
            ? result.products
            : []

      const formattedProducts = databaseProducts
        .map((product) => ({
          id: product.batch_id || product.id || product.batchId,
          productName:
            product.product_name ||
            product.productName ||
            product.name ||
            'Unnamed Product',
          commodity: product.commodity || product.category || '',
          farmerName:
            product.farmer_name ||
            product.farmerName ||
            product.farmer ||
            '',
          quantity: product.quantity,
          harvestDate: product.harvest_date || product.harvestDate,
          location: product.location || product.origin,
          status: product.status || 'Pending'
        }))
        .filter((product) => product.id)

      setProducts(formattedProducts)

      setSelectedId((currentId) => {
        const stillExists = formattedProducts.some(
          (product) => String(product.id) === String(currentId)
        )

        return stillExists
          ? currentId
          : formattedProducts[0]?.id || ''
      })

      if (formattedProducts.length === 0) {
        setQrImage('')
        setProductUrl('')
        setError('No registered products found in the database.')
      }
    } catch (err) {
      console.error('Load QR products error:', err)

      setProducts([])
      setSelectedId('')
      setQrImage('')
      setProductUrl('')

      setError(
        err.message || 'Unable to connect to the TraceFarm database.'
      )
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

  const selectedProduct = products.find(
    (product) => String(product.id) === String(selectedId)
  )

  function handleProductChange(event) {
    setSelectedId(event.target.value)
    setQrImage('')
    setProductUrl('')
    setError('')
  }

  async function handleGenerate() {
    if (!selectedProduct) {
      setError('Please select a registered product first.')
      return
    }

    setGenerating(true)
    setError('')
    setQrImage('')
    setProductUrl('')

    try {
      const url = `${window.location.origin}/trace/${encodeURIComponent(
        selectedProduct.id
      )}`

      const image = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#166534',
          light: '#FFFFFF'
        }
      })

      setProductUrl(url)
      setQrImage(image)
    } catch (err) {
      console.error('Generate QR error:', err)
      setError('QR Code failed to generate. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function formatDate(date) {
    if (!date) return '-'

    const parsed = new Date(date)

    if (Number.isNaN(parsed.getTime())) {
      return String(date)
    }

    return parsed.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatQuantity(quantity) {
    if (
      quantity === undefined ||
      quantity === null ||
      quantity === ''
    ) {
      return '-'
    }

    const value = String(quantity)

    return /\bkg\b/i.test(value) ? value : `${value} kg`
  }

  async function handleCopyUrl() {
    if (!productUrl) return

    try {
      await navigator.clipboard.writeText(productUrl)
      alert('Public Trace URL copied successfully!')
    } catch (err) {
      console.error('Copy URL error:', err)
      alert('Unable to copy URL. Please copy the URL manually.')
    }
  }

  return (
    <div className="page-content qr-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">PRODUCT TRACEABILITY</span>
          <h1>QR Code Generator</h1>
          <p>
            Generate unique QR Codes for registered agricultural products.
          </p>
        </div>
      </div>

      <div className="qr-layout">
        <div className="qr-form-card">
          <h2>Select Product</h2>
          <p className="qr-subtitle">
            Select a registered product to generate its QR Code.
          </p>

          <div className="qr-form">
            <div className="form-group">
              <label htmlFor="qrProduct">Registered Product</label>

              <select
                id="qrProduct"
                value={selectedId}
                onChange={handleProductChange}
                disabled={loading || products.length === 0}
              >
                {products.length === 0 && (
                  <option value="">No products available</option>
                )}

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.id} - {product.productName}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <>
                <div className="form-group">
                  <label>Batch ID</label>
                  <input value={selectedProduct.id} readOnly />
                </div>

                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    value={selectedProduct.productName || '-'}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Commodity</label>
                  <input
                    value={selectedProduct.commodity || '-'}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Farmer Name</label>
                  <input
                    value={selectedProduct.farmerName || '-'}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    value={formatQuantity(selectedProduct.quantity)}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Harvest Date</label>
                  <input
                    value={formatDate(selectedProduct.harvestDate)}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Farm Location</label>
                  <input
                    value={selectedProduct.location || '-'}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Verification Status</label>
                  <input value={selectedProduct.status} readOnly />
                </div>
              </>
            )}
          </div>

          {error && <p className="qr-error">{error}</p>}

          <button
            className="qr-generate-button"
            onClick={handleGenerate}
            disabled={loading || generating || !selectedProduct}
          >
            {loading
              ? 'Loading Products...'
              : generating
                ? 'Generating...'
                : 'Generate QR Code'}
          </button>

          <button
            type="button"
            onClick={loadProducts}
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '10px 15px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            Refresh Product List
          </button>
        </div>

        <div className="qr-preview-card">
          <h2>QR Code Preview</h2>
          <p className="qr-subtitle">
            Scan to open the public TraceFarm product page.
          </p>

          <div className="qr-preview">
            {qrImage ? (
              <img
                src={qrImage}
                alt="TraceFarm public product QR Code"
              />
            ) : (
              <div className="qr-empty">
                <div className="qr-empty-icon">▦</div>
                <p>No QR Code generated yet</p>
                <span>Select a product and click Generate.</span>
              </div>
            )}
          </div>

          {qrImage && selectedProduct && (
            <>
              <div className="qr-product-info">
                <strong>{selectedProduct.productName}</strong>
                <span>Batch ID: {selectedProduct.id}</span>
                <span>{selectedProduct.farmerName || '-'}</span>
              </div>

              <div
                style={{
                  margin: '15px 0',
                  padding: '12px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  overflowWrap: 'anywhere',
                  fontSize: '13px'
                }}
              >
                <strong>Product URL</strong>
                <p>{productUrl}</p>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  style={{
                    padding: '7px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Copy URL
                </button>
              </div>

              <a
                className="qr-download-button"
                href={qrImage}
                download={`${selectedProduct.id}-QR.png`}
              >
                Download QR Code
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default QRGenerator
