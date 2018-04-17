const joi = require('joi')

const schema = joi.object({
  SENTRY_DSN: joi.string().required()
}).unknown()

const { error, value: vars } = joi.validate(process.env, schema)

if (error) throw new Error(`Config validation error: ${error.message}`)

const config = {
  sentry: {
    dsn: vars.SENTRY_DSN
  }
}

module.exports = config
