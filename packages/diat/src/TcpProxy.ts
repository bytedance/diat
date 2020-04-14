import * as net from 'net'
import { EventEmitter as Event } from 'events'
import { TcpDetector } from 'diat-live-inspector'
import { DiatError } from './Error'
import { logger } from './Logger'

export interface ITcpProxyOptions {
  tcpProxyHost: string
  tcpProxyPort: number
  targetHost: string
  targetPort: number
  ignoreSocketErrors: boolean
}

const kDefaultOptions = {
  tcpProxyHost: '0.0.0.0',
  tcpProxyPort: 0,
  targetHost: '127.0.0.1',
  targetPort: 9229,
  ignoreSocketErrors: true,
}

export class TcpProxy extends Event {
  private options: ITcpProxyOptions
  private server: net.Server | null = null
  private tcpDetector: TcpDetector | null = null

  constructor(options_?: Partial<ITcpProxyOptions>) {
    super()
    this.options = Object.assign({}, kDefaultOptions, options_)
  }

  private proxySocket = (socket: net.Socket) => {
    const { ignoreSocketErrors, targetHost, targetPort } = this.options
    // The process will exit if we don't listen to "error".
    socket.on('error', err => {
      if (ignoreSocketErrors) {
        return
      }
      logger.warn(err)
    })
    socket.pause()

    const clientSocket = net.connect(targetPort, targetHost)
    clientSocket.on('error', err => {
      logger.warn(err)
    })

    const clientSocketConnect = () => {
      socket.resume()
      socket.pipe(clientSocket)
      clientSocket.pipe(socket)
    }

    const socketClose = () => {
      clientSocket.destroy()
      removeListeners()
    }

    const clientSocketClose = () => {
      socket.destroy()
      removeListeners()
    }

    const removeListeners = () => {
      clientSocket.removeListener('connect', clientSocketConnect)
      socket.removeListener('close', socketClose)
      clientSocket.removeListener('close', clientSocketClose)
    }

    clientSocket.on('connect', clientSocketConnect)
    socket.on('close', socketClose)
    clientSocket.on('close', clientSocketClose)
  }

  listen = async (): Promise<{ host: string; port: number }> => {
    const { tcpProxyHost, tcpProxyPort, targetPort } = this.options
    return new Promise((resolve, reject) => {
      this.tcpDetector = new TcpDetector(targetPort)
      this.tcpDetector.once('close', () => {
        this.destroy(true)
      })

      const server = new net.Server(this.proxySocket)
      this.server = server

      server.listen(tcpProxyPort, tcpProxyHost, () => {
        const address = server.address() as any
        if (!address) {
          reject(new DiatError('failed to listen'))
          return
        }
        resolve(
          Object.assign(
            {
              host: tcpProxyHost,
            },
            address
          )
        )
      })
    })
  }

  destroy = async (inspectorClosed: boolean = false): Promise<void> => {
    if (!this.server) {
      return
    }

    this.emit('close', inspectorClosed)

    const { server, tcpDetector } = this
    this.server = null
    this.tcpDetector = null

    if (tcpDetector) {
      tcpDetector.destroy()
    }

    return new Promise(resolve => {
      server.close(() => {
        resolve()
      })
    })
  }
}
