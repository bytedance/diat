jest.mock('child_process')

const childProcess = require('child_process')

let handleExit: any = () => {}

childProcess.exec.mockImplementation(() => {
  const mockChild = {
    on: (eventName, callback) => {
      if (eventName === 'exit') {
        setTimeout(() => {
          handleExit(callback)
        }, 100)
      }
    },
    stderr: {
      pipe: jest.fn(),
    },
    stdout: {
      pipe: jest.fn(),
    },
  }
  return mockChild
})

import { Perf } from '../src/Perf'

describe('Perf', () => {
  describe('hasPerf', () => {
    it('should return a boolean', async () => {
      expect(typeof (await Perf.hasPerf())).toBe('boolean')
    })
  })

  describe('record', () => {
    Perf.perfExist = true

    it('should return a file path', async () => {
      handleExit = (callback) => {
        callback(0)
      }

      const ret = await Perf.record({
        pid: 1,
      })
      expect(typeof ret).toBe('string')
    })

    it('should throw when child exits with non-zero code', async () => {
      handleExit = (callback) => {
        callback(1)
      }

      await expect(
        Perf.record({
          pid: 1,
        })
      ).rejects.toThrow('failed')
    })
  })

  describe('script', () => {
    Perf.perfExist = true

    it('should return a file path', async () => {
      handleExit = (callback) => {
        callback(0)
      }

      const ret = await Perf.script({
        dataFile: 'output.data',
      })
      expect(typeof ret).toBe('string')
    })

    it('should throw when child exits with non-zero code', async () => {
      handleExit = (callback) => {
        callback(1)
      }

      await expect(
        Perf.script({
          dataFile: 'output.data',
        })
      ).rejects.toThrow('failed')
    })
  })
})
