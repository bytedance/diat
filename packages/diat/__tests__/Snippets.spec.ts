import * as net from 'net'
import * as path from 'path'
import * as fs from 'fs'
import { Snippets, snippets } from '../src/Snippets'
import { kMessageSeperator } from '../src/Metric'

const kSocketPath = path.resolve(__dirname, './test.sock')

function removePipeSocket() {
  return new Promise((resolve) => {
    fs.unlink(kSocketPath, () => {
      resolve()
    })
  })
}

describe('Snippets', () => {
  describe('Snippets', () => {
    it('should get all files', async () => {
      const snippets = new Snippets()
      const obj = await snippets.getSnippets()

      expect(typeof obj).toBe('object')
      expect(Object.keys(obj).length).toBeGreaterThan(0)

      const content = await snippets.getSnippet('get_active_handles', {
        a: 10,
      })
      expect(content).toBeTruthy()
    })
  })

  describe('metric_collect', () => {
    it('should work', async () => {
      await removePipeSocket()

      const server = net.createServer()

      await new Promise((resolve) => {
        server.listen(kSocketPath, () => {
          resolve()
        })
      })

      const code = await snippets.getSnippet('metric_collect', {
        interval: 500,
        messageSeperator: kMessageSeperator,
        socketPath: kSocketPath,
      })

      eval(code)

      const socket: net.Socket = await new Promise((resolve) => {
        server.once('connection', (socket) => {
          resolve(socket)
        })
      })

      const msg = await new Promise<any>((resolve) => {
        let msg = ''
        socket.once('data', (data) => {
          msg += data.toString('utf8')

          const index = msg.indexOf(kMessageSeperator)
          if (index >= 0) {
            resolve(JSON.parse(msg.slice(0, index)))
          }
        })
      })

      expect(msg.cpuUsage).toMatchObject({
        user: expect.anything(),
        system: expect.anything(),
      })
      expect(msg.memoryUsage).toMatchObject({
        rss: expect.anything(),
        heapTotal: expect.anything(),
        heapUsed: expect.anything(),
        external: expect.anything(),
      })
      expect(msg.uv).toMatchObject({
        latency: expect.anything(),
        handle: expect.anything(),
        request: expect.anything(),
      })

      socket.destroy()
      server.close()
    })
  })
})
