'use strict'

const URL = require('url')
const QS = require('querystring')

module.exports = function (baseOpts) {
  if (baseOpts == null) { baseOpts = {} }
  return function addLinkTo (req, res, next) {
    const proto = req.protocol
    let hostname = req.headers.host
    let proxyBase = ''
    let fullPath = req.originalUrl
    if (req.app.get('trust proxy')) {
      hostname = req.headers['x-forwarded-host'] || req.headers.host
      proxyBase = req.headers['x-forwarded-path'] || ''
      fullPath = proxyBase + fullPath
    }
    const hrefFull = `${proto}://${hostname}${fullPath}`
    function linkTo (path, moreOpts) {
      let ix, query
      if (moreOpts == null) { moreOpts = {} }
      const opts = Object.assign({
        params: false,
        absolute: 'proxy'
      }, baseOpts, moreOpts)
      // Absolute links can start at current route, proxy base, or host
      if (path[0] === '/') {
        let pathInsert
        switch (opts.absolute) {
          case 'host': pathInsert = ''; break
          case 'proxy': pathInsert = proxyBase; break
          case 'route': pathInsert = proxyBase + req.baseUrl; break
        }
        path = pathInsert + path
      }
      // strip off any params from path, will be added back on later
      if ((ix = path.indexOf('?')) !== -1) {
        query = QS.parse(path.substr(ix + 1))
        path = path.substr(0, ix)
      } else {
        query = {}
      }
      // tack on ALL parameters
      if (opts.params === true) {
        query = Object.assign({}, req.query, query)
      } else if (Array.isArray(opts.params)) {
        const tmp = {}
        for (let p of opts.params) {
          if (req.query[p]) { tmp[p] = req.query[p] }
        }
        query = Object.assign(tmp, query)
      } else if (typeof opts.params === 'function') {
        const tmp = {}
        for (let p in req.query) {
          if (opts.params(p, req.query[p])) { tmp[p] = req.query[p] }
        }
        query = Object.assign(tmp, query)
      }
      // Resolve the URL relative to origin URL
      let url = URL.resolve(hrefFull, path)
      query = QS.encode(query)
      // Tack on any query items
      if (query) { url += `?${query}` }
      return url
    }
    req.linkto = req.linkTo = linkTo
    return next()
  }
}
