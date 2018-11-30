/* eslint-env mocha */
require('should')
const debug = require('debug')('linkto')
debug.enabled = true
const URL = require('url')
const supertest = require('supertest')
const express = require('express')
const linkTo = require('./')
// Request handler which shows a few variants of the linkto
function handler (req, res, next) {
  res.set('x-there', req.linkTo('there'))
  res.set('x-back', req.linkTo('../back'))
  res.set('x-base', req.linkTo('/base'))
  res.set('x-params', req.linkTo('params?a=A&b=B'))
  res.redirect(303, req.linkto('quux'))
}

// Default options testing
describe('default options', function () {
  const app = express()
  app.set('trust proxy', true)
  app.use(linkTo())
  app.get('/foo/bar/baz', handler)
  it('should redirect appropriately', () => {
    return supertest(app).get('/foo/bar/baz?one=1').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      res.headers.location.should.equal('http://example.com/foo/bar/quux')
      res.headers['x-there'].should.equal('http://example.com/foo/bar/there')
      res.headers['x-back'].should.equal('http://example.com/foo/back')
      res.headers['x-base'].should.equal('http://example.com/base')
      res.headers['x-params'].should.equal('http://example.com/foo/bar/params?a=A&b=B')
    })
  })
  it('should honor reverse proxy headers', () => {
    return supertest(app).get('/foo/bar/baz').set({
      host: 'example.com',
      'X-Forwarded-Path': '/basepath',
      'X-Forwarded-Proto': 'https'
    }).expect(303).expect((res) => {
      res.headers['x-base'].should.equal('https://example.com/basepath/base')
      res.headers['location'].should.equal('https://example.com/basepath/foo/bar/quux')
    })
  })
  it('should prefer X-Forwarded-Host to Host header', () => {
    return supertest(app).get('/foo/bar/baz').set({
      Host: 'example.com',
      'X-Forwarded-Host': 'www.example.com'
    }).expect(303).expect(function (res) {
      res.headers['location'].should.equal('http://www.example.com/foo/bar/quux')
    })
  })
})
// No proxying options
describe('no proxy options', function () {
  const app = express()
  app.set('trust proxy', false)
  app.use(linkTo())
  app.get('/foo/bar/baz', handler)
  it('should ignore all X-Forwarded-* headers', () => {
    return supertest(app).get('/foo/bar/baz').set({
      host: 'example.com',
      'X-Forwarded-Host': 'forward.example.com',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Path': '/all/your/base'
    }).expect(303).expect(function (res) {
      res.headers['location'].should.equal('http://example.com/foo/bar/quux')
      res.headers['x-base'].should.equal('http://example.com/base')
    })
  })
})
// Parameter options
describe('parameter preservation true', function () {
  const app = express()
  app.set('trust proxy', true)
  app.use(linkTo({ params: true }))
  app.get('/foo/bar/baz', handler)
  it('should include ALL params for true', () => {
    return supertest(app).get('/foo/bar/baz?one=1').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      res.headers['location'].should.equal('http://example.com/foo/bar/quux?one=1')
    })
  })
  it('should merge parameters, preferring new URL', () => {
    return supertest(app).get('/foo/bar/baz?a=Ape&c=Cheetah').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      // 'Location' header does not add own params, uses those given
      Object.assign({}, URL.parse(res.headers.location, true).query).should.eql({
        a: 'Ape',
        c: 'Cheetah'
      })
      // 'x-params' header adds own params named 'a' and 'b'
      Object.assign({}, URL.parse(res.headers['x-params'], true).query).should.eql({
        a: 'A',
        b: 'B',
        c: 'Cheetah'
      })
    })
  })
})
// Parameter options
describe('selective parameter preservation', function () {
  const app = express()
  app.set('trust proxy', true)
  app.use(linkTo({ params: ['c'] }))
  app.get('/foo/bar/baz', handler)
  it('should include ALL params for true', () => {
    return supertest(app).get('/foo/bar/baz?a=Ape&c=Cheetah').set({
      host: 'example.com'
    }).expect(303).expect('location', 'http://example.com/foo/bar/quux?c=Cheetah')
  })
  it('should merge parameters, preferring new URL', () => {
    return supertest(app).get('/foo/bar/baz?a=Ape&c=Cheetah&d=Duck').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      // 'Location' header does not add own params, uses those given
      Object.assign({}, URL.parse(res.headers.location, true).query).should.eql({
        c: 'Cheetah'
      })
      // 'x-params' header adds own params named 'a' and 'b'
      Object.assign({}, URL.parse(res.headers['x-params'], true).query).should.eql({
        a: 'A',
        b: 'B',
        c: 'Cheetah'
      })
    })
  })
})
// Parameter options
describe('functional parameter preservation', function () {
  const app = express()
  app.set('trust proxy', true)
  app.use(linkTo({
    params (k, v) { return /^keep/.test(k) }
  }))
  app.get('/foo/bar/baz', handler)
  it('should include ALL params for true', () => {
    return supertest(app).get('/foo/bar/baz?a=Ape&keepC=Cheetah').set({
      host: 'example.com'
    }).expect(303).expect('location', 'http://example.com/foo/bar/quux?keepC=Cheetah')
  })
  it('should merge parameters, preferring new URL', () => {
    return supertest(app).get('/foo/bar/baz?a=Ape&keepC=Cheetah&d=Duck').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      // 'Location' header does not add own params, uses those given
      Object.assign({}, URL.parse(res.headers.location, true).query).should.eql({
        keepC: 'Cheetah'
      })
      // 'x-params' header adds own params named 'a' and 'b'
      Object.assign({}, URL.parse(res.headers['x-params'], true).query).should.eql({
        a: 'A',
        b: 'B',
        keepC: 'Cheetah'
      })
    })
  })
})
// testing when added onto a different base route!
describe('express router usage', function () {
  const app = express()
  const router = express.Router()
  app.set('trust proxy', true)
  app.use(linkTo())
  app.use('/routebase', router)
  router.get('/foo/bar', handler)
  it('should correctly insert from base url', function () {
    const base = 'http://example.com/routebase'
    return supertest(app).get('/routebase/foo/bar').set({
      host: 'example.com'
    }).expect(303).expect(function (res) {
      res.headers.location.should.equal(`${base}/foo/quux`)
      res.headers['x-there'].should.equal(`${base}/foo/there`)
      res.headers['x-back'].should.equal(`${base}/back`)
      res.headers['x-base'].should.equal('http://example.com/base')
    })
  })
  it('should correctly handle x-forwarded-path with router base', function () {
    const base = 'http://example.com/nginx/frontend'
    return supertest(app).get('/routebase/foo/bar').set({
      host: 'example.com',
      'x-forwarded-path': '/nginx/frontend'
    }).expect(303).expect(function (res) {
      res.headers.location.should.equal(`${base}/routebase/foo/quux`)
      res.headers['x-base'].should.equal(`${base}/base`)
      res.headers['x-there'].should.equal(`${base}/routebase/foo/there`)
      res.headers['x-back'].should.equal(`${base}/routebase/back`)
    })
  })
})
// Testing the optional different starting points of absolute linking
describe('absolute=host option', function () {
  const app = express()
  const router = express.Router()
  app.set('trust proxy', true)
  app.use(linkTo({ absolute: 'host' })) // Only use the host!
  app.use('/routebase', router)
  router.get('/foo/bar', handler)

  it('should correctly handle x-forwarded-path with router base', function () {
    const base = 'http://example.com'
    return supertest(app).get('/routebase/foo/bar').set({
      host: 'example.com',
      'x-forwarded-path': '/nginx/frontend'
    }).expect(303).expect('x-base', `${base}/base`)
  })
})
// Testing the optional different starting points of absolute linking
describe('absolute=route option', function () {
  const app = express()
  const router = express.Router()
  app.set('trust proxy', true)
  app.use(linkTo({ absolute: 'route' })) // Confine absolute to route!
  app.use('/routebase', router)
  router.get('/foo/bar', handler)
  it('should correctly handle x-forwarded-path with router base', function () {
    const base = 'http://example.com/nginx/frontend/routebase'
    return supertest(app).get('/routebase/foo/bar').set({
      host: 'example.com',
      'x-forwarded-path': '/nginx/frontend'
    }).expect(303).expect('x-base', `${base}/base`)
  })
})
describe('absolute=route, params=[list,of,names]', function () {
  const app = express()
  const router = express.Router()
  app.set('trust proxy', true)
  app.use(linkTo({
    absolute: 'route',
    params: ['c']
  })) // Confine absolute to route!
  app.use('/routebase', router)
  router.get('/foo/bar', handler)
  it('should correctly handle x-forwarded-path with router base', function () {
    const base = 'http://example.com/nginx/frontend/routebase'
    return supertest(app).get('/routebase/foo/bar?c=yes').set({
      host: 'example.com',
      'x-forwarded-path': '/nginx/frontend'
    }).expect(303).expect('x-base', `${base}/base?c=yes`)
  })
})
