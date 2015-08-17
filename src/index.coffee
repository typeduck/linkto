###############################################################################
# Middleware for creating href links to other resources
###############################################################################

URL = require "url"
QS = require "querystring"
_ = require("lodash")

module.exports = (baseOpts = {}) ->
  return (req, res, next) ->
    proto = req.protocol # honors proxy trust
    hostname = req.headers.host
    proxyBase = ""
    fullPath = req.originalUrl
    if req.app.get("trust proxy")
      hostname = req.headers["x-forwarded-host"] or req.headers.host
      proxyBase = req.headers["x-forwarded-path"] or ""
      fullPath = proxyBase + fullPath
    hrefFull = "#{proto}://#{hostname}#{fullPath}"
    req.linkto  = req.linkTo = (path, moreOpts = {}) ->
      opts = _.assign({
        params: false
        absolute: "proxy"
      }, baseOpts, moreOpts)
      # Absolute links can start at current route, proxy base, or host
      if path[0] is "/"
        switch opts.absolute
          when "host" then pathInsert = ""
          when "proxy" then pathInsert = proxyBase
          when "route" then pathInsert = proxyBase + req.baseUrl
        path = pathInsert + path
      # strip off any params from path, will be added back on later
      if (ix = path.indexOf("?")) isnt -1
        query = QS.parse(path.substr(ix + 1))
        path = path.substr(0, ix)
      else
        query = {}
      # tack on ALL parameters
      if opts.params is true
        query = _.assign(_.clone(req.query), query)
      else if Array.isArray(opts.params)
        query = _.assign(_.pick(req.query, opts.params), query)
      else if "function" is typeof opts.params
        predicate = (val, key) -> opts.params(key, val)
        query = _.assign(_.pick(req.query, predicate), query)
      # Resolve the URL relative to origin URL
      url = URL.resolve(hrefFull, path)
      # Tack on any query items
      if query = QS.encode(query) then url += "?#{query}"
      return url
    next()
