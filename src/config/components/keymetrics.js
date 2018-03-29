const joi = require('joi')

const schema = joi.object({
  KEYMETRICS_PUBLIC: joi.string().required(),
  KEYMETRICS_SECRET: joi.string().required()
}).unknown()
  .required()

const { error, value: vars } = joi.validate(process.env, schema)

if (error) throw new Error(`Config validation error: ${error.message}`)

const config = {
  keymetrics: {
    public: vars.KEYMETRICS_PUBLIC,
    secret: vars.KEYMETRICS_SECRET
  }
}

module.exports = config
