const request = require('supertest')
const faker = require('faker')

describe('load express', () => {
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

  it (`responds to '/' with JSON`, (done) => {
    request(app)
      .get('/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200, done)
  })

  it (`responds to empty post request to '/submit' with 404`, (done) => {
    request(app)
      .post('/submit')
      .expect(404, done())
  })

  it (`responds to post request to '/submit' with 200`, (done) => {
    request(app)
      .post('/submit')
      .field('id', faker.random.uuid())
      .field('analyticsId', faker.random.uuid())
      .field('first_name', faker.name.firstName())
      .field('last_name', faker.name.lastName())
      .field('email', faker.internet.email())
      .expect(200, done())
  })
})
