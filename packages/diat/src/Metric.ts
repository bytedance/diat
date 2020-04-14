import * as net from 'net'
import { EventEmitter as Event } from 'events'
import * as stream from 'stream'
import * as path from 'path'
import * as fs from 'fs'
import * as ansi from 'ansi-escapes'
import * as bytes from 'bytes'
import * as util from 'util'

interface IOptions {
  std: stream.Writable
  socketPath: string
}

interface IMessage {
  cpuUsage: {
    user: number
    system: number
  }
  memoryUsage: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  uv: {
    handle: number
    request: number
    latency: number
  }
}

const kDefaultOptions = {
  std: process.stdout,
}
const kSocketFileName = `diat_metrics.sock`
export const kMessageSeperator = '__$'
const kMetricTypeNumber = 3

function getAbsolutePath(filename: string): string {
  if (path.isAbsolute(filename)) {
    return filename
  }

  return path.resolve(process.cwd(), `./${filename}`)
}

function clearLines(std: any, line: number) {
  std.write(ansi.eraseLines(line) + ansi.cursorLeft)
}

function formatLoad(load: number): string | number {
  if (!load) {
    return load
  }

  return load.toPrecision(2)
}

/**
 * - create an unix domain socket and wait for connections, when connected:
 *  - wait for messages, calulcate them, and output
 *  - when disconnected or exiting:
 *    - exit
 * - not connections and timeout:
 *  - log error
 */
export class Metric extends Event {
  private options: IOptions
  private server: net.Server | null = null
  private socket: net.Socket | null = null
  private closed: boolean = false

  constructor(options: Partial<IOptions>) {
    super()
    this.options = Object.assign(
      {
        socketPath: kSocketFileName,
      },
      kDefaultOptions,
      options
    )

    this.options.socketPath = getAbsolutePath(
      this.options.socketPath || kSocketFileName
    )
  }

  destroy = (err?: Error | null, getClosed: boolean = false) => {
    if (this.closed) {
      return
    }
    this.closed = true

    // TODO handle err
    const { server, socket } = this

    if (socket) {
      socket.destroy()
    }

    if (server) {
      server.close()
      this.unlinkSocketPath()
    }

    this.server = null
    this.socket = null
    if (getClosed) {
      this.emit('get_closed')
    }
  }

  private unlinkSocketPath = () => {
    return util
      .promisify(fs.unlink)(this.options.socketPath)
      .catch(() => {})
  }

  private writeState = (message: IMessage) => {
    const { std } = this.options
    clearLines(std, kMetricTypeNumber)
    const { user, system } = message.cpuUsage
    const { rss, heapTotal, heapUsed, external } = message.memoryUsage
    const { latency, request, handle } = message.uv
    std.write(
      `[cpu] load(user): ${formatLoad(user)} load(system): ${formatLoad(
        system
      )}\n`
    )
    std.write(
      `[memory] rss: ${bytes(rss)} heapTotal: ${bytes(
        heapTotal
      )} heapUsed: ${bytes(heapUsed)} external: ${bytes(external)}\n`
    )
    std.write(
      `[uv] handle: ${handle}, request: ${request}, latency: ${latency}ms`
    )
  }

  private calculate = (message: IMessage) => {
    // TODO handle invalid message structure
    this.writeState(message)
  }

  private handleConnection = (socket: net.Socket) => {
    if (this.socket) {
      socket.destroy()
      return
    }

    this.socket = socket

    let err: Error | null = null
    let message = ''

    const parseMessage = () => {
      let index = message.indexOf(kMessageSeperator)
      while (index >= 0) {
        const frame = message.slice(0, index)
        message = message.slice(index + kMessageSeperator.length)
        this.calculate(JSON.parse(frame))
        index = message.indexOf(kMessageSeperator)
      }
    }

    socket.on('data', data => {
      const msg = data.toString('utf8')
      message += msg
      parseMessage()
    })
    socket.on('error', error => {
      err = error
    })
    socket.once('close', () => {
      this.destroy(err, true)
    })
  }

  public createServer = async (): Promise<string> => {
    const { socketPath } = this.options

    await this.unlinkSocketPath()

    this.server = net.createServer(this.handleConnection)

    const server = this.server as net.Server

    await new Promise(resolve => {
      server.listen(socketPath, () => {
        resolve()
      })
    })

    return socketPath
  }
}
