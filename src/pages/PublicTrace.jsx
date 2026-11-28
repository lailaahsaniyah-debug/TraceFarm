
import { useEffect, useState } from 'react'

// Menggunakan URL backend dari environment variable saat deployment.
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const SOLANA_EXPLORER_URL = 'https://explorer.solana.com/tx/'

function formatDate(date) {
  if (!date) return '-'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(date) {
  if (!date) return '-'

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatQuantity(quantity) {
  if (quantity === undefined || quantity === null || quantity === '') {
    return '-'
  }

  const value = String(quantity)
  return /\bkg\b/i.test(value) ? value : `${value} kg`
}

function getStatusColors(status) {
  if (status === 'Verified' || status === 'Completed') {
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '#bbf7d0',
    }
  }

  if (status === 'Rejected') {
    return {
      background: '#fee2e2',
      color: '#991b1b',
      border: '#fecaca',
    }
  }

  return {
    background: '#fef3c7',
    color: '#92400e',
    border: '#fde68a',
  }
}

function StatusBadge({ status }) {
  const colors = getStatusColors(status || 'Pending')

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 11px',
        borderRadius: '20px',
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        fontSize: '12px',
        fontWeight: '700',
      }}
    >
      {status || 'Pending'}
    </span>
  )
}

function PublicTrace({ batchId }) {
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState([])
  const [verificationHistory, setVerificationHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadPublicTrace() {
    if (!batchId) {
      setError('No Batch ID was provided.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [verificationResponse, trackingResponse] =
        await Promise.all([
          fetch(`${API_URL}/verification/${encodeURIComponent(batchId)}`),
          fetch(`${API_URL}/tracking/${encodeURIComponent(batchId)}`),
        ])

      const verificationData = await verificationResponse.json()
      const trackingData = await trackingResponse.json()

      if (!verificationResponse.ok || !verificationData.success) {
        throw new Error(
          verificationData.message || 'Unable to retrieve product information.'
        )
      }

      if (!trackingResponse.ok || !trackingData.success) {
        throw new Error(
          trackingData.message || 'Unable to retrieve tracking history.'
        )
      }

      const productData = verificationData.product

      setProduct({
        id: productData.batch_id,
        productName: productData.product_name,
        commodity: productData.commodity,
        farmerName: productData.farmer_name,
        quantity: productData.quantity,
        harvestDate: productData.harvest_date,
        location: productData.location,
        status: productData.status || 'Pending',
      })

      const trackingEvents = (trackingData.data || []).map((item) => ({
        id: item.id,
        stage: item.stage,
        status: item.status || 'Pending',
        location: item.location,
        date: item.event_date,
        description: item.description,
      }))

      setHistory(trackingEvents)

      const auditRecords = (verificationData.history || []).map((record) => ({
        id: record.id,
        productName: productData.product_name,
        previousStatus: record.previous_status,
        newStatus: record.new_status,
        decision: record.decision,
        verifiedBy: record.verified_by,
        verifiedAt: record.verified_at,
        note: record.note,
        auditId: record.audit_id,
        solanaHash: record.solana_hash,
        solanaSignature: record.solana_signature,
        solanaWallet: record.solana_wallet,
        solanaNetwork: record.solana_network,
        solanaAnchoredAt: record.solana_anchored_at,
        solanaSlot: record.solana_slot,
      }))

      setVerificationHistory(auditRecords)
    } catch (err) {
      console.error('Public trace error:', err)
      setError(err.message || 'Unable to load product traceability data.')
      setProduct(null)
      setHistory([])
      setVerificationHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPublicTrace()
  }, [batchId])

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f3f7f4',
      padding: '32px 18px',
      color: '#1f2937',
      fontFamily: 'Arial, sans-serif',
    },
    container: {
      maxWidth: '850px',
      margin: '0 auto',
    },
    header: {
      textAlign: 'center',
      marginBottom: '30px',
    },
    logo: {
      color: '#166534',
      fontSize: '27px',
      fontWeight: '800',
    },
    card: {
      background: '#fff',
      padding: '25px',
      borderRadius: '14px',
      marginBottom: '20px',
      boxShadow: '0 3px 15px rgba(0,0,0,0.04)',
    },
    eyebrow: {
      color: '#15803d',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '1.5px',
    },
    heading: {
      margin: '8px 0 20px',
      fontSize: '23px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '20px',
    },
    label: {
      color: '#6b7280',
      fontSize: '12px',
      display: 'block',
      marginBottom: '7px',
    },
    value: {
      fontSize: '15px',
      fontWeight: '700',
      overflowWrap: 'anywhere',
    },
    event: {
      borderLeft: '3px solid #16a34a',
      padding: '5px 0 22px 20px',
      marginLeft: '8px',
      position: 'relative',
    },
    auditEvent: {
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '17px',
      marginTop: '14px',
    },
    auditMeta: {
      color: '#6b7280',
      fontSize: '13px',
      marginTop: '7px',
      lineHeight: '1.7',
    },
    proofBox: {
      marginTop: '18px',
      padding: '18px',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '10px',
    },
    proofTitle: {
      color: '#166534',
      fontSize: '15px',
      fontWeight: '800',
      marginBottom: '12px',
    },
    proofValue: {
      color: '#1f2937',
      fontSize: '12px',
      fontWeight: '600',
      overflowWrap: 'anywhere',
      lineHeight: '1.7',
    },
    explorerLink: {
      display: 'inline-block',
      marginTop: '15px',
      background: '#166534',
      color: '#fff',
      padding: '10px 15px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontSize: '13px',
      fontWeight: '700',
    },
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logo}>TraceFarm</div>
          <p style={{ fontSize: '12px', letterSpacing: '2px' }}>
            AGRICULTURE TRACEABILITY
          </p>
          <span
            style={{
              display: 'inline-block',
              padding: '7px 13px',
              borderRadius: '20px',
              background: '#dcfce7',
              color: '#166534',
              fontSize: '12px',
              fontWeight: '700',
            }}
          >
            PRODUCT TRACEABILITY
          </span>
        </header>

        {loading ? (
          <section style={styles.card}>
            <p style={{ textAlign: 'center', color: '#6b7280' }}>
              Loading product traceability data...
            </p>
          </section>
        ) : error ? (
          <section style={styles.card}>
            <h2>Unable to Load Product</h2>
            <p style={{ color: '#b91c1c' }}>{error}</p>
            <button
              onClick={loadPublicTrace}
              style={{
                background: '#166534',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 18px',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              Try Again
            </button>
          </section>
        ) : !product ? (
          <section style={styles.card}>
            <h2>Product Not Found</h2>
            <p>
              We could not find a product with Batch ID {batchId}.
            </p>
          </section>
        ) : (
          <>
            <section style={styles.card}>
              <span style={styles.eyebrow}>PRODUCT INFORMATION</span>
              <h1 style={styles.heading}>{product.productName}</h1>

              <div style={styles.grid}>
                <div>
                  <span style={styles.label}>BATCH ID</span>
                  <div style={styles.value}>{product.id}</div>
                </div>

                <div>
                  <span style={styles.label}>COMMODITY</span>
                  <div style={styles.value}>{product.commodity || '-'}</div>
                </div>

                <div>
                  <span style={styles.label}>FARMER</span>
                  <div style={styles.value}>{product.farmerName || '-'}</div>
                </div>

                <div>
                  <span style={styles.label}>ORIGIN</span>
                  <div style={styles.value}>{product.location || '-'}</div>
                </div>

                <div>
                  <span style={styles.label}>QUANTITY</span>
                  <div style={styles.value}>
                    {formatQuantity(product.quantity)}
                  </div>
                </div>

                <div>
                  <span style={styles.label}>HARVEST DATE</span>
                  <div style={styles.value}>
                    {formatDate(product.harvestDate)}
                  </div>
                </div>

                <div>
                  <span style={styles.label}>VERIFICATION STATUS</span>
                  <StatusBadge status={product.status} />
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <span style={styles.eyebrow}>TRACEABILITY HISTORY</span>
              <h2 style={styles.heading}>Product Journey</h2>

              {history.length === 0 ? (
                <p>
                  No tracking events have been recorded for this product yet.
                </p>
              ) : (
                history.map((item, index) => (
                  <div
                    style={styles.event}
                    key={item.id || `${item.stage}-${index}`}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '-9px',
                        top: '7px',
                        width: '14px',
                        height: '14px',
                        background:
                          item.status === 'Completed' ? '#16a34a' : '#9ca3af',
                        borderRadius: '50%',
                        border: '2px solid white',
                      }}
                    />

                    <span style={styles.eyebrow}>
                      STEP {String(index + 1).padStart(2, '0')}
                    </span>

                    <h3 style={{ margin: '7px 0' }}>{item.stage}</h3>

                    <StatusBadge status={item.status} />

                    <p>{item.description}</p>

                    <div style={styles.grid}>
                      <div>
                        <span style={styles.label}>LOCATION</span>
                        <strong>{item.location || '-'}</strong>
                      </div>
                      <div>
                        <span style={styles.label}>DATE</span>
                        <strong>{formatDate(item.date)}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section style={styles.card}>
              <span style={styles.eyebrow}>VERIFICATION HISTORY</span>
              <h2 style={styles.heading}>Verification Audit Trail</h2>

              <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: '1.6' }}>
                Review the verification decisions recorded for this product.
              </p>

              {verificationHistory.length === 0 ? (
                <div
                  style={{
                    padding: '18px',
                    background: '#f9fafb',
                    borderRadius: '10px',
                    color: '#6b7280',
                    fontSize: '13px',
                  }}
                >
                  No verification records have been published for this product yet.
                </div>
              ) : (
                verificationHistory.map((record, index) => (
                  <article
                    key={record.auditId || `${record.id}-${index}`}
                    style={styles.auditEvent}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <strong style={{ fontSize: '15px' }}>
                        {record.productName || product.productName}
                      </strong>

                      <StatusBadge
                        status={record.newStatus || record.decision}
                      />
                    </div>

                    <div style={styles.auditMeta}>
                      <div>
                        <strong>Verified by:</strong>{' '}
                        {record.verifiedBy || 'Unknown verifier'}
                      </div>

                      <div>
                        <strong>Previous status:</strong>{' '}
                        {record.previousStatus || 'Not recorded'}
                      </div>

                      <div>
                        <strong>New status:</strong>{' '}
                        {record.newStatus || record.decision || 'Unknown'}
                      </div>

                      <div>
                        <strong>Verification date:</strong>{' '}
                        {formatDateTime(record.verifiedAt)}
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <strong>Verification note:</strong>
                        <p style={{ margin: '5px 0 0' }}>
                          {record.note || 'No verification note provided.'}
                        </p>
                      </div>

                      <div style={{ marginTop: '10px', overflowWrap: 'anywhere' }}>
                        <strong>Audit ID:</strong>{' '}
                        {record.auditId || 'Not available'}
                      </div>
                    </div>

                    {record.solanaSignature && record.solanaHash ? (
                      <div style={styles.proofBox}>
                        <div style={styles.proofTitle}>
                          ✓ Anchored on Solana Devnet
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={styles.label}>NETWORK</span>
                          <div style={styles.proofValue}>
                            {record.solanaNetwork || 'Devnet'}
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={styles.label}>AUDIT HASH (SHA-256)</span>
                          <div style={styles.proofValue}>
                            {record.solanaHash}
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={styles.label}>TRANSACTION SIGNATURE</span>
                          <div style={styles.proofValue}>
                            {record.solanaSignature}
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={styles.label}>VERIFIER WALLET</span>
                          <div style={styles.proofValue}>
                            {record.solanaWallet || '-'}
                          </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span style={styles.label}>BLOCKCHAIN SLOT</span>
                          <div style={styles.proofValue}>
                            {record.solanaSlot ?? '-'}
                          </div>
                        </div>

                        <div>
                          <span style={styles.label}>ANCHORED AT</span>
                          <div style={styles.proofValue}>
                            {formatDateTime(record.solanaAnchoredAt)}
                          </div>
                        </div>

                        <a
                          href={`${SOLANA_EXPLORER_URL}${encodeURIComponent(record.solanaSignature)}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.explorerLink}
                        >
                          View Transaction on Solana Explorer ↗
                        </a>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '15px',
                          padding: '12px',
                          borderRadius: '8px',
                          background: '#f9fafb',
                          color: '#6b7280',
                          fontSize: '12px',
                        }}
                      >
                        No Solana blockchain proof is attached to this audit record.
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
          </>
        )}

        <footer
          style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '12px',
            padding: '15px',
            lineHeight: '1.8',
          }}
        >
          TraceFarm v1.0 · Agriculture Traceability
          <br />
          Powered by PostgreSQL and Solana Devnet
        </footer>
      </div>
    </div>
  )
}

export default PublicTrace
