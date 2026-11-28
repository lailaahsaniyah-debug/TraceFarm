
import app from '../server/index.js'

export default function handler(req, res) {
  const originalUrl = req.url || '/'
  const queryIndex = originalUrl.indexOf('?')

  const pathname = queryIndex === -1
    ? originalUrl
    : originalUrl.slice(0, queryIndex)

  const query = queryIndex === -1
    ? ''
    : originalUrl.slice(queryIndex)

  if (!pathname.startsWith('/api')) {
    req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`
  }

  return app(req, res)
}
