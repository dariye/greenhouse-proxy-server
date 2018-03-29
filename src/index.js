const http = require('http')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const cookieSession = require('cookie-session')
const csurf = require('csurf')
const helmet = require('helmet')
const noCache = require('nocache')
const fetch = require('node-fetch')
const multer = require('multer')
const cache = require('memory-cache')
const cors = require('cors')
const FormData = require('form-data')
const RateLimit = require('express-rate-limit')
const Raven = require('raven')

const config = require('./config')

Raven.config(config.sentry.dsn).install()

async function board () {
  const res = await fetch(config.greenhouse.board)
  const { jobs } = await res.json()
  return await Promise.all(jobs.map(async ({ id }) => {
    const job = await fetch(`${config.greenhouse.board}/${id}?questions=true`)
    return job.json()
  }))
}

function transform (jobs) {
  return jobs.map(({
    id,
    title,
    content,
    offices,
    departments,
    questions
  }) => {
    return {
      id,
      title,
      content,
      offices,
      departments,
      questions: questions.map(({fields, label, required}) => {
        return {
          label,
          required,
          value: '',
          ...fields[0]
        }
      })
    }
  })
}

function paginate () {
  return new Promise ((resolve, reject) => {
    board()
      .then((res) => {
        const transformed = transform(res)
        if (!transformed) return reject(new Error('No data'))
        return resolve(transformed)
      })
  })
}

async function find (id) {
  return new Promise (async (resolve, reject) => {
    if (cache.get(id)) return resolve(cache.get(id))
    const listings = Array.from(cache.get('listings'))
    job = listings.find((job) => {
      return parseInt(job.id) === parseInt(id)
    })
    cache.put(id, job)
    return resolve(job)
  })
}

function postApplication (req) {
  return new Promise((resolve, reject) => {
    const form = FormData()

    const { body, files } = req
    const { id } = body

    if (!body || Object.keys(body).length < 1) return reject (new Error('invalid_request_body'))

    Object.keys(body).forEach(key => {
      form.append(key, body[key])
    })

    if (files && Object.keys(files).length > 0) {
      Object.keys(files).forEach(key => {
        const file = files[key][0]
        form.append(key, fs.createReadStream(file.path))
      })
    }

    fetch(`${config.greenhouse.board}/${id}`, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(config.greenhouse.apiKey).toString("base64")}`
      },
      body: form
    }).then(res => {
      if (!res || res.status !== 200) return reject(res)
      return resolve(res)
    }).catch(err => {
      return reject(err)
    })
  })
}


// Middlewares
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

const attachments = multer({ storage: storage })
const limiter = new RateLimit({
  windowMs: 15*60*1000,
  max: 100,
  delayMs: 0
})

// const parseJson = bodyParser.json()
// const parseForm = bodyParser.urlencoded({ extended: false })
// const parseBody = [parseJson, parseForm]
/**
 * Config: multer
 * accepts fields with name:
 * - resume
 * - cover_letter
 */
// const parseUploads = attachments.fields([
//   { name: 'resume', maxCount: 1},
//   { name: 'cover_letter', maxCount: 1 }
// ])
//
// const csrfProtection = csurf({ cookie: true })

const app = express()

app.use(Raven.requestHandler())
app.use(helmet())
app.use(noCache())
app.disable('etag')
app.enable('trust proxy', 1)
app.use(limiter)
app.use(cors())

app.get('/', async (req, res) => {
  try {
    let listings = cache.get('listings')
    if (!listings) {
      listings = await paginate()
      if (!listings) throw new Error('No return value from Greenhouse')
      cache.put('listings', listings)
    }
    return res.status(200).json({ listings })
  } catch (err) {
    console.log(err)
    return res.status(500).json({ "ok": false, "error": "no_gh_jobs", message: err.message })
  }
})

app.get('/job/:id',
  async (req, res) => {
  const { id } = req.params
  try {
    let listings = cache.get('listings')
    if (!listings) {
      listings = await paginate()
      cache.put('listings', listings)
    }
    const job = await find(id)
    if (!job || Object.keys(job).length === 0) throw new Error(`No job found with id: '${id}'`)
    return res.status(200).json({ job })
  } catch (err) {
    console.log(err)
    return res.status(404).json({ "ok": false , "error": "job_not_found", message: err.message })
  }
})

app.post('/job/:id',
  attachments.fields([
    { name: 'resume', maxCount: 1},
    { name: 'cover_letter', maxCount: 1 }
  ]),
  async (req, res, next) => {
    if (!req.body && Object.keys(req.body).length === 0) return res.status(400).send({ "ok": false, "error": "invalid_request" })
    if (!req.body.id) return res.status(400).send({ "ok": false, "error": "missing_id" })
    if (!req.body.first_name) return res.status(400).send({ "ok": false, "error": "missing_first_name" })
    if (!req.body.last_name) return res.status(400).send({ "ok": false, "error": "missing_last_name"})
    if (!req.body.email) return res.status(400).send({ "ok": false, "error": "missing_email" })

    try {
      const response = await postApplication(req)
      if (!response) throw new Error(`Application for job with id '${req.body.id}' failed to submit`)
      next()
    } catch (err) {
      console.log(err)
      return res.status(400).json({ "ok": false, "error": "missing_fields", message: err.message })
    }
  }, (req, res, next) => {
    return res.status(200).json({ ...req.body, "ok": true })
})

const server = http.createServer(app)
server.listen(config.server.port || 3000, null,
  () => {
    console.log("Listening on: localhost:" + config.server.port || 3000)
  })

module.exports = server
