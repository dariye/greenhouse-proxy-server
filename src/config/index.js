'use strict'

if (process.env.NODE_ENV === 'development') {
  require('dotenv').config({ silent: true })
}

const server = require('./components/server')
const sentry = require('./components/sentry')
const greenhouse = require('./components/greenhouse')
const keymetrics = require('./components/keymetrics')

module.exports = Object.assign({}, server, sentry, greenhouse, keymetrics)
