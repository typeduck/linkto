###############################################################################
# Middleware for creating href links to other resources
###############################################################################

URL = require "url"
QS = require "querystring"
_ = require("lodash")

module.exports = (baseOpts = {}) ->
  return (req, res, next) ->
    proto = req.protocol # honors proxy trust
    baseUrl = req.baseUrl or ""
    if req.app.get("trust proxy")
      hostname = req.headers["x-forwarded-host"] or req.headers.host
      baseUrl = (req.headers["x-forwarded-path"] or "") + baseUrl
    else
      hostname = req.headers.host
    hrefFull = "#{proto}://#{hostname}#{baseUrl}#{req.path}"
    req.linkTo  = req.linkTo = (path, moreOpts = {}) ->
      opts = _.assign({
        params: false
      }, baseOpts, moreOpts)
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
      # Resolve the URL relative to origin URL
      url = URL.resolve(hrefFull, path)
      # Tack on any query items
      if query = QS.encode(query) then url += "?#{query}"
      return url
    next()
