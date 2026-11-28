
import app from '../server/index.js'

export default function handler(req, res) {
  const incomingUrl = req.url || '/'
  const queryIndex = incomingUrl.indexOf('?')

  let pathname = queryIndex === -1
    ? incomingUrl
    : incomingUrl.slice(0, queryIndex)

  const query = queryIndex === -1
    ? ''
    : incomingUrl.slice(queryIndex)

  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    pathname = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  }

  req.url = `${pathname}${query}`

  return app(req, res)
}
