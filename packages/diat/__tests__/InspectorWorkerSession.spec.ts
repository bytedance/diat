import * as inspector from 'inspector'
import * as util from 'util'
import * as path from 'path'
import { InspectorWorkerSession } from '../src/InspectorWorkerSession'
import { hasWorker, isCiTest, kTimeout } from './utils'

describe('InspectorWorkerSession', () => {
  const workers: any[] = []
  const sessionId = '1'
  let session: inspector.Session
  let post: any
  let workerSession: InspectorWorkerSession

  if (!hasWorker() || isCiTest()) {
    it('(skipped)', () => {})
    return
  }

  const thread = require('worker_threads')

  beforeAll(async () => {
    for (let i = 0; i < 2; i += 1) {
      const worker = new thread.Worker(
        path.resolve(__dirname, './test_process/thread_worker.js')
      )
      await new Promise<void>((resolve) => {
        worker.once('online', () => {
          resolve()
        })
      })
      worker.unref()
      workers.push(worker)
    }
  })

  afterAll(async () => {
    // NOTE Workers won't exit so we add '--forceExit' to jest.
    for (const worker of workers) {
      await worker.terminate()
    }
  })

  beforeEach(async () => {
    session = new inspector.Session()
    session.connect()
    post = util.promisify(session.post.bind(session))
    workerSession = new InspectorWorkerSession({
      comm: {
        post,
        event: {
          removeListener: (name, cb) => {
            return session.removeListener(name, cb)
          },
          addListener: (name, cb) => {
            return session.addListener(name, (msg) => {
              cb(msg.params)
            })
          },
        } as any,
      },
      host: '0.0.0.0',
      port: 0,
      sessionId,
    })

    await new Promise((resolve) => {
      session.post(
        'NodeWorker.enable',
        {
          waitForDebuggerOnStart: false,
        },
        resolve
      )
    })
  })

  afterEach(async () => {
    await workerSession.destroy()
    await post('NodeWorker.disable')
    session.disconnect()
  })

  it('should work', async () => {
    const ret = await workerSession.inspect()

    expect(ret).toEqual({
      host: expect.anything(),
      port: expect.anything(),
      address: expect.anything(),
      family: expect.anything(),
    })
  })

  it('should emit close when detached', async () => {
    await workerSession.inspect()

    const p = new Promise<void>((resolve) => {
      workerSession.once('close', () => {
        resolve()
      })
    })

    await post('NodeWorker.detach', {
      sessionId,
    })

    await p
  })
})
