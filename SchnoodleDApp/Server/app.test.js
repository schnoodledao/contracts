'use strict'

const { test } = require('tap')
const build = require('./app')

test('requests the "/" route', async t => {
  const app = build();

  const response = await app.inject({
    method: 'GET',
    url: '/Alive'
  })
  t.equal(response.statusCode, 200, 'returns a status code of 200')
})
