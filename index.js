require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const helmet = require('helmet')
const fetch = require('node-fetch')
const multer = require('multer')
const FormData = require('form-data')

const apiKey = process.env.GH_JOBS_API_KEY
const ghJobsEndpoint = process.env.GH_JOBS_BOARD
const limit = process.env.PAGINATION_LIMIT || 50
const port = process.env.PORT || 3000

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

async function paginate (page) {
  const { jobs, meta } = await board()
  const { total } = meta
  const limit = 50
  const pages = Math.ceil(total/limit)
  const index = ((page - 1)*limit)
  const current = index+limit
  return new Promise((resolve) => {
    const transformed = transform(jobs.slice(index, current), total)
    if (transformed) return resolve(transformed)
    }
  )
}

function postApplication (req) {
  const { body, files } = req

  const form = FormData()

  Object.keys(body).forEach(key => {
    form.append(key, body[key])
  })

  Object.keys(files).forEach(key => {
    form.append(key, files[key][0])
  })

  return new Promise((resolve, reject) => {
    fetch(`${ghJobsEndpoint}/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'multipart/form-data',
        ...form.getHeaders()
      },
      body: form
    }).then(res => res.json())
      .then(json => resolve(json))
      .catch(err => reject(err))
  })
}


const app = express()
// app.use(bodyParser.json())
app.use(helmet())
app.disable('etag')

app.get('/', async (req, res) => {
  const { page = 1 } = req.query
  const data = await paginate(page)
  return res.status(200).send(JSON.stringify(data))
})

const attachments = multer()
app.post('/submit',
  attachments.fields([{ name: 'resume', maxCount: 1}, { name: 'cover_letter', maxCount: 1 }]),
  async (req, res, next) => {
  if (!req.body) return res.status(400).send({ "ok": false, "error": "invalid_request" })
  if (!req.body.id) return res.status(400).send({ "ok": false, "error": "missing_id" })
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
