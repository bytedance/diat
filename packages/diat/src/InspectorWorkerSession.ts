import * as ws from 'ws'
import { EventEmitter as Event } from 'events'
import { IComm } from './Types'
import { snippets } from './Snippets'
import { TcpProxy } from './TcpProxy'
import { parseInspectorUrl } from './utils'

interface IConfig {
  comm: IComm
  sessionId: string
  host: string
  port: number
}

const kDefaultEvaluateOptions = {
  awaitPromise: true,
  includeCommandLineAPI: true,
}

/**
 * NOTE: It seems only one session availiable.
 */
export class InspectorWorkerSession extends Event {
  private config: IConfig
  private server: ws.Server | null = null
  private closed: boolean = false
  private tcpProxy: TcpProxy | null = null

  constructor(config: IConfig) {
    super()
    this.config = config

    this.config.comm.event.addListener(
      'NodeWorker.detachedFromWorker',
      this.handleWorkerDetached
    )
  }

  private handleWorkerDetached = (info) => {
    const { sessionId } = this.config
    const { sessionId: msgSesssionId } = info

    if (msgSesssionId === sessionId) {
      this.destroy()
    }
  }

  private openWorkerInspector = async (): Promise<{
    host: string
    port: number
  }> => {
    const code = await snippets.getSnippet('open_inspector')
    const { comm, sessionId } = this.config
    const { event, post } = comm
    let id = 0

    const waitInspectorOpenMsg = () =>
      new Promise((resolve) => {
        const cleanUp = (message: any) => {
          event.removeListener(
            'NodeWorker.receivedMessageFromWorker',
            handleMsg
          )
          resolve(message)
        }
        const handleMsg = (info) => {
          if (info.sessionId === sessionId) {
            const message = JSON.parse(info.message)
            // TODO better solutions?
            if (message.id === 2) {
              cleanUp(message)
            }
          }
        }
        event.addListener('NodeWorker.receivedMessageFromWorker', handleMsg)
      })

    const p = waitInspectorOpenMsg()

    await post('NodeWorker.sendMessageToWorker', {
      sessionId,
      message: JSON.stringify({ id: ++id, method: 'Runtime.enable' }),
    })
    await post('NodeWorker.sendMessageToWorker', {
      sessionId,
      message: JSON.stringify({
        method: 'Runtime.evaluate',
        id: ++id,
        params: {
          expression: code,
          ...kDefaultEvaluateOptions,
        },
      }),
    })

    const message: any = await p

    await post('NodeWorker.sendMessageToWorker', {
      sessionId,
      message: JSON.stringify({ id: ++id, method: 'Runtime.disable' }),
    })

    if (
      message.result &&
      message.result.result &&
      message.result.result.type === 'string'
    ) {
      const ret = JSON.parse(message.result.result.value)
      const parseRet = parseInspectorUrl(ret.url)
      if (parseRet) {
        return parseRet
      }
    }

    throw new Error(
      `failed to open inspector inside the worker: ${JSON.stringify(
        message,
        null,
        2
      )}`
    )
  }

  // TODO(oyyd): inspector.close() is missed in threads
  closeInspector = async () => {
    //
  }

  inspect = async () => {
    const { host, port } = await this.openWorkerInspector()

    this.tcpProxy = new TcpProxy({
      targetHost: host,
      targetPort: port,
    })

    return this.tcpProxy.listen()
  }

  destroy = async () => {
    if (this.closed) {
      return
    }

    this.closed = true

    const { server, tcpProxy } = this
    const { sessionId } = this.config
    this.server = null
    this.tcpProxy = null

    this.config.comm.event.removeListener(
      'NodeWorker.detachedFromWorker',
      this.handleWorkerDetached
    )

    this.emit('close', sessionId)

    await this.closeInspector()

    if (tcpProxy) {
      await tcpProxy.destroy()
    }

    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    }
  }
}
