###############################################################################
# Unit testing for linkto middleware
###############################################################################
URL = require "url"
QS = require "querystring"
should = require("should")
supertest = require("supertest")
express = require("express")
linkTo = require("./")
# Request handler which shows a few variants of the linkto
handler = (req, res, next) ->
  res.set("x-there", req.linkTo("there"))
  res.set("x-back", req.linkTo("../back"))
  res.set("x-base", req.linkTo("/base"))
  res.set("x-params", req.linkTo("params?a=A&b=B"))
  res.redirect(303, req.linkTo("quux"))

# Default options testing
describe "default options", () ->
  app = express()
  app.set("trust proxy", true)
  app.use(linkTo())
  app.get("/foo/bar/baz", handler)
  it "should redirect appropriately", (done) ->
    supertest(app)
      .get("/foo/bar/baz?one=1")
      .set("host", "example.com")
      .expect(303)
      .expect("location", "http://example.com/foo/bar/quux")
      .expect("x-there", "http://example.com/foo/bar/there")
      .expect("x-back", "http://example.com/foo/back")
      .expect("x-base", "http://example.com/base")
      .expect("x-params", "http://example.com/foo/bar/params?a=A&b=B")
      .end(done)
  it "should honor reverse proxy headers", (done) ->
    supertest(app)
      .get("/foo/bar/baz")
      .set("host", "example.com")
      .set("X-Forwarded-Path", "/basepath")
      .set("X-Forwarded-Proto", "https")
      .expect(303)
      .expect("x-base", "https://example.com/basepath/base")
      .expect("location", "https://example.com/basepath/foo/bar/quux")
      .end(done)
  it "should prefer X-Forwarded-Host to Host header", (done) ->
    supertest(app)
      .get("/foo/bar/baz")
      .set("Host", "example.com")
      .set("X-Forwarded-Host", "www.example.com")
      .expect(303)
      .expect("location", "http://www.example.com/foo/bar/quux")
      .end(done)
# No proxying options
describe "no proxy options", () ->
  app = express()
  app.set("trust proxy", false)
  app.use(linkTo())
  app.get("/foo/bar/baz", handler)
  it "should ignore all X-Forwarded-* headers", (done) ->
    supertest(app).get("/foo/bar/baz")
      .set("host", "example.com")
      .set("X-Forwarded-Host", "forward.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Path", "/all/your/base")
      .expect(303)
      .expect("location", "http://example.com/foo/bar/quux")
      .expect("x-base", "http://example.com/base")
      .end(done)
# Parameter options
describe "parameter preservation true", () ->
  app = express()
  app.set("trust proxy", true)
  app.use(linkTo({params: true}))
  app.get("/foo/bar/baz", handler)
  it "should include ALL params for true", (done) ->
    supertest(app).get("/foo/bar/baz?one=1")
      .set("host", "example.com")
      .expect(303)
      .expect("location", "http://example.com/foo/bar/quux?one=1")
      .end(done)
  it "should merge parameters, preferring new URL", (done) ->
    supertest(app).get("/foo/bar/baz?a=Ape&c=Cheetah")
      .set("host", "example.com")
      .expect(303)
      .end (err, res) ->
        return done(err) if err
        # 'Location' header does not add own params, uses those given
        URL.parse(res.headers['location'], true).query.should.eql {
          a: "Ape"
          c: "Cheetah"
        }
        # 'x-params' header adds own params named 'a' and 'b'
        URL.parse(res.headers['x-params'], true).query.should.eql {
          a: "A"
          b: "B"
          c: "Cheetah"
        }
        done()
# Parameter options
describe "selective parameter preservation", () ->
  app = express()
  app.set("trust proxy", true)
  app.use(linkTo({params: ["c"]}))
  app.get("/foo/bar/baz", handler)
  it "should include ALL params for true", (done) ->
    supertest(app).get("/foo/bar/baz?a=Ape&c=Cheetah")
      .set("host", "example.com")
      .expect(303)
      .expect("location", "http://example.com/foo/bar/quux?c=Cheetah")
      .end(done)
  it "should merge parameters, preferring new URL", (done) ->
    supertest(app).get("/foo/bar/baz?a=Ape&c=Cheetah&d=Duck")
      .set("host", "example.com")
      .expect(303)
      .end (err, res) ->
        return done(err) if err
        # 'Location' header does not add own params, uses those given
        URL.parse(res.headers['location'], true).query.should.eql {
          c: "Cheetah"
        }
        # 'x-params' header adds own params named 'a' and 'b'
        URL.parse(res.headers['x-params'], true).query.should.eql {
          a: "A"
          b: "B"
          c: "Cheetah"
        }
        done()
# testing when added onto a different base route!
describe "express router usage", () ->
  app = express()
  app.set("trust proxy", true)
  app.use(linkTo())
  app.use("/routebase", router = express.Router())
  router.get("/foo/bar", handler)
  it "should correctly insert from base url", (done) ->
    base = "http://example.com/routebase"
    supertest(app).get("/routebase/foo/bar")
      .set("host", "example.com")
      .expect(303)
      .expect("location", "#{base}/foo/quux")
      .end (err, res) ->
        res.headers["x-there"].should.equal("#{base}/foo/there")
        res.headers["x-back"].should.equal("#{base}/back")
        res.headers["x-base"].should.equal("http://example.com/base")
        done(err)
  it "should correctly handle x-forwarded-path with router base", (done) ->
    base = "http://example.com/nginx/frontend"
    supertest(app).get("/routebase/foo/bar")
      .set("host", "example.com")
      .set("x-forwarded-path", "/nginx/frontend")
      .expect(303)
      .expect("location", "#{base}/routebase/foo/quux")
      .expect("x-base", "#{base}/base")
      .end (err, res) ->
        res.headers["x-there"].should.equal("#{base}/routebase/foo/there")
        res.headers["x-back"].should.equal("#{base}/routebase/back")
        done(err)
