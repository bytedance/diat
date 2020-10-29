import * as childProcess from 'child_process'
import * as path from 'path'
export { isNodeVersionLE8 } from '../src/utils'

const kFilePath = path.resolve(__dirname, './test_process/testIdleServer.js')

export const kTimeout = 30 * 1000

export function createTestProcess(requireFile?: string, execArgv?: string[]) {
  return new Promise<{ child: childProcess.ChildProcess; message: any }>(
    (resolve) => {
      const args = requireFile
        ? [path.resolve(__dirname, `./test_process/${requireFile}.js`)]
        : []
      const options: any = {
        env: {},
      }
      if (Array.isArray(execArgv)) {
        options.execArgv = execArgv
      }
      const child = childProcess.fork(kFilePath, args, options)

      child.once('message', (message) => {
        resolve({
          child,
          message,
        })
      })
    }
  )
}

export function hasWorker(): boolean {
  try {
    return Boolean(require('worker_threads'))
  } catch (err) {
    //
  }
  return false
}

export function wait(t: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, t)
  })
}

export function isCiTest() {
  return process.env.CI_TEST === '1'
}
