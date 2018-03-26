const request = require('supertest')
const faker = require('faker')

describe('start server ...', () => {
  let app
  beforeEach(() => {
    app = require('../src')
  })
  afterEach(() => {
    app.close()
  })

  it (`responds to '/'`, (done) => {
    request(app)
      .get('/')
      .expect(200, done)
  })

  it (`responds to GET: '/' with JSON`, (done) => {
    request(app)
      .get('/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200, done)
  })

  it (`responds to GET: '/job' with 404`, (done) => {
    request(app)
      .get('/job')
      .expect(404, done())
  })

  it (`responds to GET: '/job/:id' (with random id) 404`, (done) => {
    const id = faker.random.uuid()
    request(app)
      .get(`/job/${id}`)
      .expect('Content-Type', /json/)
      .expect(404, done())
  })

  it (`responds to POST: '/job/:id' (with empty body) with 400`, (done) => {
    const id = faker.random.uuid()
    request(app)
      .post(`/job/${id}`)
      .expect(400, done())
  })

  it (`responds to POST: '/job/:id' (with missing id) with 400`, (done) => {
    const id = faker.random.uuid()
    request(app)
      .post(`/job/${id}`)
      .field('id', id)
      .expect(400, done())
  })

  it (`responds to POST: '/job/:id' (with missing first_name) with 400`, (done) => {
    const id = faker.random.uuid()
    const last_name = faker.name.lastName()
    request(app)
      .post(`/job/${id}`)
      .field('id', id)
      .field('last_name', last_name)
      .expect(400, done())
  })

  it (`responds to POST: '/job/:id' (with missing last_name) with 400`, (done) => {
    const id = faker.random.uuid()
    const first_name = faker.name.firstName()
    request(app)
      .post(`/job/${id}`)
      .field('id', id)
      .field('first_name', first_name)
      .expect(400, done())
  })

  it (`responds to POST: '/job/:id' (with missing email) with 400`, (done) => {
    const id = faker.random.uuid()
    const first_name = faker.name.firstName()
    const last_name = faker.name.lastName()
    request(app)
      .post(`/job/${id}`)
      .field('id', id)
      .field('first_name', first_name)
      .field('last_name', last_name)
      .expect(400, done())
  })

  it (`responds to POST: '/job/:id' with 500 (cannot post job with fake job id :) )`, (done) => {
    const id = faker.random.uuid()
    const first_name = faker.name.firstName()
    const last_name = faker.name.lastName()
    const email = faker.internet.email()

    request(app)
      .post(`/job/${id}`)
      .field('id', id)
      .field('first_name', first_name)
      .field('last_name', last_name)
      .field('email', email)
      .expect(500, done())
  })
})
