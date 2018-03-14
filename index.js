require('dotenv').config()
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const noCache = require('nocache')
const fetch = require('node-fetch')
const multer = require('multer')
const cors = require('cors')
const FormData = require('form-data')
const RateLimit = require('express-rate-limit')

const apiKey = process.env.GH_JOBS_API_KEY
const ghJobsEndpoint = process.env.GH_JOBS_BOARD
const limit = process.env.PAGINATION_LIMIT || 50
const port = process.env.PORT || 3000

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


async function board () {
  const res = await fetch(ghJobsEndpoint)
  const json = await res.json()
  return json
}

function transform (jobs, total) {
  const now = Date.now() / 1000 | 0
  return {
    results_size: parseInt(total),
    results: jobs.map((job) => {
      return {
        id: job.id.toString(),
        title: job.title,
        description: job.title,
        image_url: 'https://avatars.io/static/default_128.jpg',
        last_update: now,
        blob: { job }
      }
    }).sort((a,b) => b.last_update - a.last_update)
  }
}

function paginate (page) {
  return new Promise ((resolve, reject) => {
    board()
      .then(res => {
        const { jobs, meta } = res
        const { total } = meta
        const limit = 50
        const pages = Math.ceil(total/limit)
        const index = ((page - 1)*limit)
        const current = index+limit
        const transformed = transform(jobs.slice(index, current), total)
        if (!transformed) return reject(new Error('No data'))
        return resolve(transformed)
      })
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


const app = express()
app.use(helmet())
app.use(noCache())
app.disable('etag')
app.enable('trust proxy')
app.use(limiter)
app.use(cors())

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  try {
    const { page = 1 } = req.query
    const data = await paginate(page)
    return res.status(200).send(JSON.stringify(data))
  } catch (err) {
    console.log(err)
    return res.status(400).send({ "ok": false })
  }
})


app.post('/submit',
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

app.listen(port, () => console.log(`listening on localhost: ${port}`))
