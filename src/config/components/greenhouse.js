const joi = require('joi')

const schema = joi.object({
  GH_JOBS_BOARD: joi.string().required(),
  GH_JOBS_API_KEY: joi.string().required()
}).unknown()
  .required()

const { error, value: vars } = joi.validate(process.env, schema)

if (error) throw new Error(`Config validation error: ${error.message}`)

const config = {
  greenhouse: {
    board: vars.GH_JOBS_BOARD,
    apiKey: vars.GH_JOBS_API_KEY
  }
}

module.exports = config
