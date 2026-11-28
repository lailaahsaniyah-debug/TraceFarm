import app from '../server/index.js'

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')

  const batchId = url.searchParams.get('__batchId')

  if (url.pathname === '/api/tracking' && batchId) {
    url.pathname = `/api/tracking/${encodeURIComponent(batchId)}`
    url.searchParams.delete('__batchId')
  }

  if (!url.pathname.startsWith('/api/')) {
    url.pathname = `/api${url.pathname.startsWith('/') ? '' : '/'}${url.pathname}`
  }

  req.url = `${url.pathname}${url.search}`

  return app(req, res)
}