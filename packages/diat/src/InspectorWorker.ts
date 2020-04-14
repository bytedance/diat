import { InspectorWorkerSession } from './InspectorWorkerSession'
import { IComm } from './Types'

interface IInspectorWorker {
  host: string
  port: number
}

const kDefaultConfig: IInspectorWorker = {
  host: '0.0.0.0',
  port: 0,
}

export interface IWorkerAttachInfo {
  sessionId: string
  workerInfo: {
    workerId: string
    type: string
    title: string
    url: string
  }
  waitingForDebugger: boolean
}

const kWaitWorkerAttaching = 500

function wait(t) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, t)
  })
}

export class InspectorWorker {
  private comm: IComm
  private config: IInspectorWorker
  private sessionMap: Map<string, InspectorWorkerSession> = new Map()

  constructor(comm: IComm, config: Partial<IInspectorWorker> = {}) {
    this.comm = comm
    this.config = Object.assign({}, kDefaultConfig, config)
  }

  destroy = async () => {
    const { post } = this.comm
    this.removeAllSessions()
    await post('NodeWorker.disable', {})
  }

  getWorkers = async (): Promise<IWorkerAttachInfo[]> => {
    // TODO timeout for unsupported versions of Node.js
    const { event, post } = this.comm
    const waitForDebuggerOnStart = false

    const infos: IWorkerAttachInfo[] = []

    const onWorker = (info: any) => {
      infos.push(info)
    }

    event.addListener('NodeWorker.attachedToWorker', onWorker)

    // Assume that all workers will attach before 'NodeWorker.enable' resolved.
    await post('NodeWorker.enable', {
      waitForDebuggerOnStart,
    })

    await wait(kWaitWorkerAttaching)

    event.removeListener('NodeWorker.attachedToWorker', onWorker)

    return infos
  }

  private removeSession = async (sessionId: string) => {
    const session = this.sessionMap.get(sessionId)
    this.sessionMap.delete(sessionId)

    if (session) {
      await session.destroy()
    }
  }

  private removeAllSessions = async () => {
    const keys = this.sessionMap.keys()
    let it = keys.next()

    while (!it.done) {
      const sessionId = it.value
      const session = this.sessionMap.get(sessionId)
      if (session) {
        session.destroy()
      }
      it = keys.next()
    }

    this.sessionMap.clear()
  }

  createWorkerSession = async (
    sessionId: string
  ): Promise<{ host: string; port: number }> => {
    if (!sessionId) {
      throw new Error(`invalid session id: ${sessionId}`)
    }
    if (this.sessionMap.get(sessionId)) {
      throw new Error(`the session id: ${sessionId} is already exists`)
    }
    const { host, port } = this.config
    const session = new InspectorWorkerSession({
      sessionId,
      comm: this.comm,
      host,
      port,
    })
    this.sessionMap.set(sessionId, session)

    session.once('close', () => {
      this.removeSession(sessionId)
    })

    try {
      const addr = await session.inspect()
      return addr
    } catch (err) {
      this.removeSession(sessionId)
      throw err
    }
  }
}
