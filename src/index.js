require('dotenv').config()
const http = require('http')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
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

const sentryDSN = process.SENTRY_DSN
Raven.config(sentryDSN).install()

const apiKey = process.env.GH_JOBS_API_KEY
const ghJobsEndpoint = process.env.GH_JOBS_BOARD
const limit = process.env.PAGINATION_LIMIT || 50
const port = process.env.PORT || 3000

async function board () {
  const res = await fetch(`${ghJobsEndpoint}`)
  const { jobs } = await res.json()
  return await Promise.all(jobs.map(async ({ id }) => {
    const job = await fetch(`${ghJobsEndpoint}/${id}?questions=true`)
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

    fetch(`${ghJobsEndpoint}/${id}`, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(apiKey).toString("base64")}`
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
      cache.put('listings', listings)
    }
    return res.status(200).json({ listings })
  } catch (err) {
    console.log(err)
    return res.status(400).send({ "ok": false })
  }
})

// app.use(bodyParser.urlencoded({ extended: false }))
// app.use(cookieParser())
// app.use(csurf({ cookie: true }))

app.get('/job/:id', async (req, res) => {
  try {
    let listings = cache.get('listings')
    if (!listings) {
      listings = await paginate()
      cache.put('listings', listings)
    }
    const job = await find(req.params.id)
    return res.status(200).json({ job })
  } catch (err) {
    console.log(err)
    return res.status(400).send({ "ok": false })
  }
})

app.post('/job/:id',
  attachments.fields([{ name: 'resume', maxCount: 1}, { name: 'cover_letter', maxCount: 1 }]),
  async (req, res, next) => {
    if (!req.body && Object.keys(req.body).length === 0) return res.status(400).send({ "ok": false, "error": "invalid_request" })
    if (!req.body.id) return res.status(400).send({ "ok": false, "error": "missing_id" })
    if (!req.body.analyticsId) return res.status(400).send({ "ok": false, "error": "missing_analyticsId" })
    if (!req.body.first_name) return res.status(400).send({ "ok": false, "error": "missing_first_name" })
    if (!req.body.last_name) return res.status(400).send({ "ok": false, "error": "missing_last_name"})
    if (!req.body.email) return res.status(400).send({ "ok": false, "error": "missing_email" })

    try {
      const response = await postApplication(req)
      if (!response) throw new Error(`Application for ${req.body.id} failed to submit`)
      next()
    } catch (err) {
      console.log(err)
      return res.status(400).send({ "ok": false, "error": "failed_submission" })
    }
}, function (req, res, next) {
  return res.status(200).send({ ...req.body, "ok": true })
})

const server = http.createServer(app)
server.listen(process.env.PORT || 3000, null,
  () => {
    console.log("Listening on: localhost:" + process.env.PORT || 3000)
  })

module.exports = server
