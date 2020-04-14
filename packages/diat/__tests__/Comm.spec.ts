import * as path from 'path'
import * as fs from 'fs'
import fetch from 'node-fetch'
import { promisify } from 'util'
import { Comm, getEvaluateResult } from '../src/Comm'
import { createTestProcess, kTimeout, hasWorker } from './utils'

const readFile = promisify(fs.readFile)

async function isJSONFile(filePath): Promise<boolean> {
  const content = await readFile(filePath)
  try {
    JSON.parse(content.toString('utf8'))
  } catch (err) {
    return false
  }
  return true
}

describe('Comm', () => {
  describe('features', () => {
    let child
    let comm: Comm

    beforeEach(async () => {
      child = (await createTestProcess()).child
      comm = new Comm(child.pid, undefined)
      await comm.connect()
    })

    afterEach(async () => {
      await comm.disconnect()
      child.kill()
    })

    it('should throw for invalid parameters', () => {
      expect(() => new Comm(undefined, undefined)).toThrow()
    })

    it(
      'should exec snippets',
      async () => {
        const ret1 = await comm.run('get_active_handles')
        expect(typeof ret1).toBe('object')
        expect(ret1).toBeTruthy()
        const ret2 = await comm.run('get_active_requests')
        expect(typeof ret2).toBe('object')
        expect(ret2).toBeTruthy()
      },
      kTimeout
    )

    it(
      'should take heapsnapshot',
      async () => {
        const filePath = path.resolve(__dirname, './my.heapsnapshot')
        const result = await comm.takeHeapsnapshot({
          file: filePath,
        })
        expect(result).toEqual({
          file: filePath,
        })
        await isJSONFile(filePath)
        // const noFileResult = await comm.takeHeapsnapshot({});
        // await isJSONFile(noFileResult.file);
      },
      kTimeout
    )

    it(
      'should cpu profile',
      async () => {
        const filePath = path.resolve(__dirname, './my.cpuprofile')
        await expect(
          comm.cpuProfile({ duration: 'abc' as any })
        ).rejects.toThrow('expect')
        const result = await comm.cpuProfile({
          file: filePath,
          duration: 1000,
        })
        expect(result).toEqual({
          file: filePath,
        })
        await isJSONFile(filePath)
      },
      kTimeout
    )

    it(
      'should heap profile',
      async () => {
        const filePath = path.resolve(__dirname, './my.heapprofile')
        await expect(
          comm.heapProfile({ duration: 'abc' as any })
        ).rejects.toThrow('expect')
        const result = await comm.heapProfile({
          file: filePath,
          duration: 1000,
        })
        expect(result).toEqual({
          file: filePath,
        })
        await isJSONFile(filePath)
      },
      kTimeout
    )

    it(
      'should track heap objects allocation',
      async () => {
        const filePath = path.resolve(__dirname, './my.heaptimeline')
        await expect(
          comm.heapTimeline({ duration: 'abc' as any })
        ).rejects.toThrow('expect')
        const result = await comm.heapTimeline({
          track: false,
          file: filePath,
          duration: 1000,
        })
        expect(result).toEqual({
          file: filePath,
        })
        await isJSONFile(filePath)
      },
      kTimeout
    )

    it(
      'should return results',
      async () => {
        const result = await comm.exec('throw new Error("invalid")')
        expect(result).toEqual({
          type: 'error',
          content: expect.stringContaining('invalid'),
        })

        const result2 = await comm.exec('{}')
        expect(result2).toEqual({
          type: 'error',
          content: expect.stringContaining('unexpected'),
        })

        const result3 = await comm.exec('"hello"')
        expect(result3).toEqual({
          type: 'success',
          content: 'hello',
        })
      },
      kTimeout
    )

    it(
      'should open inspect port',
      async () => {
        const ret = await comm.openInspect()
        expect(ret).toEqual({
          host: expect.anything(),
          address: expect.anything(),
          family: expect.anything(),
          port: expect.anything(),
          tcpProxy: expect.anything(),
        })
      },
      kTimeout
    )

    it(
      'should open inspect port with specified port',
      async () => {
        const ret = await comm.openInspect({ port: 9229 })
        expect(ret).toEqual({
          host: expect.anything(),
          address: expect.anything(),
          family: expect.anything(),
          port: expect.anything(),
          tcpProxy: expect.anything(),
        })
      },
      kTimeout
    )

    it(
      'should get metrics infos',
      async () => {
        const ret = await comm.startMetric()
        expect(ret).toBeTruthy()
      },
      kTimeout
    )
  })

  if (hasWorker()) {
    describe('InspectWorker', () => {
      it(
        'should open an inspect port for workers',
        async () => {
          const child = (await createTestProcess('thread')).child
          const comm = new Comm(child.pid, undefined)
          await comm.connect()

          const workers = await comm.getWorkers()
          expect(workers.length).toBe(2)
          await comm.inspectWorker(workers[0].sessionId)

          await comm.disconnect()
          child.kill()
        },
        kTimeout
      )
    })
  }

  describe('Comm.openInspect', () => {
    it(
      'should open inspect port with specified port',
      async () => {
        const child = (await createTestProcess()).child
        process.kill(child.pid, 'SIGUSR1')
        const comm = new Comm(undefined, '127.0.0.1:9229')

        const ret = await comm.openInspect()
        expect(ret).toEqual({
          host: expect.anything(),
          address: expect.anything(),
          family: expect.anything(),
          port: expect.anything(),
          tcpProxy: expect.anything(),
        })

        const res = await fetch(`http://${ret.host}:${ret.port}/json`, {})
        const json = await res.json()
        expect(Array.isArray(json)).toBe(true)

        await comm.disconnect()

        await expect(
          fetch(`http://${ret.host}:${ret.port}/json`, {})
        ).rejects.toThrow()

        child.kill()
      },
      kTimeout
    )
  })

  describe('getEvaluateResult', () => {
    it('should return data of error if there is no "result" property', () => {
      expect(getEvaluateResult({})).toEqual({
        type: 'error',
        content: expect.stringMatching('unexpected structure'),
      })
    })
  })
})
