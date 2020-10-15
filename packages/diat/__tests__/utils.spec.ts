jest.mock('node-fetch')
const fetch = require('node-fetch')

import { getAbsolutePath, getPublicIP, getFirstSessionURL } from '../src/utils'

fetch.mockImplementation(() => {
  return Promise.resolve({
    json: () =>
      Promise.resolve(
        JSON.parse(`[ {
      "description": "node.js instance",
      "devtoolsFrontendUrl": "chrome-devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:9229/9d2df447-011d-4fb1-81b5-0d943a06f9f1",
      "devtoolsFrontendUrlCompat": "chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:9229/9d2df447-011d-4fb1-81b5-0d943a06f9f1",
      "faviconUrl": "https://nodejs.org/static/favicon.ico",
      "id": "9d2df447-011d-4fb1-81b5-0d943a06f9f1",
      "title": "node[67022]",
      "type": "node",
      "url": "file://",
      "webSocketDebuggerUrl": "ws://127.0.0.1:9229/9d2df447-011d-4fb1-81b5-0d943a06f9f1"
    } ]
    `)
      ),
  })
})

describe('utils', () => {
  describe('getAbsolutePath', () => {
    it('should work', async () => {
      expect(getAbsolutePath('./abc')).not.toEqual('./abc')
      expect(getAbsolutePath('/abc')).toEqual('/abc')
    })
  })

  describe('getPublicIP', () => {
    it('should work', async () => {
      const ip = await getPublicIP()
      expect(typeof ip === 'string' || ip === null).toBe(true)
    })
  })

  describe('getFirstSessionURL', () => {
    it('should work', async () => {
      const ret = await getFirstSessionURL('127.0.0.1', 9229, '127.0.0.1')
      expect(ret).toContain('devtools://')
    })

    it('should supportproxy url', async () => {
      const ret = await getFirstSessionURL(
        '127.0.0.1',
        9229,
        '127.0.0.1',
        (url) => {
          return Promise.resolve('MY_URL')
        }
      )
      expect(ret).toContain('devtools://')
      expect(ret).toContain('MY_URL')
    })

    it('should support to replace the whole url', async () => {
      const ret = await getFirstSessionURL(
        '127.0.0.1',
        9229,
        '127.0.0.1',
        (url) => {
          return Promise.resolve({
            completeUrl: 'devtools://abc',
          })
        }
      )
      expect(ret).toBe('devtools://abc')
    })
  })
})
