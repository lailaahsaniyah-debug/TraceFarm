import app from '../../server/index.js'

export default function handler(req, res) {
  const batchId = req.query?.batchId

  if (!batchId || typeof batchId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Batch ID is required',
    })
  }

  const queryIndex = (req.url || '').indexOf('?')
  const query = queryIndex === -1
    ? ''
    : req.url.slice(queryIndex)

  req.url = `/api/tracking/${encodeURIComponent(batchId)}${query}`

  return app(req, res)
}