import * as assert from 'assert'
import * as fs from 'fs'
import * as util from 'util'
import { Communication } from 'diat-live-inspector'
import { snippets } from './Snippets'
import { NodeInspectWrapper } from './NodeInspectWrapper'
import { TcpProxy, ITcpProxyOptions } from './TcpProxy'
import { getAbsolutePath, getDefaultFileName, isNodeVersionLE8 } from './utils'
import { DiatError } from './Error'
import { InspectorWorker } from './InspectorWorker'
import { Metric } from './Metric'
import { IPostFunc } from './Types'

interface IAttachOptions {
  host: string
  port: number
}

interface ITakeHeapsnapshotOptions {
  file: string
}

interface IProfileOptions {
  file: string
  duration: number
  interval: number
}

interface IHeapTimelineOptions {
  file: string
  duration: number
  track: boolean
}

interface IFileResult {
  file: string
}

interface IOpenInspectInfo {
  host: string
  port: number
  tcpProxy: TcpProxy
}

interface IOpenInspectOptions {
  port?: number
}

interface IEvaluteResult {
  type: 'error' | 'success'
  content: string
}

const kFileTypes = {
  cpuprofile: '.cpuprofile',
  heapsnapshot: '.heapsnapshot',
  heapprofile: '.heapprofile',
  heaptimeline: '.heaptimeline',
}

function createUnknownResult(ret: any): IEvaluteResult {
  return {
    type: 'error',
    content: 'unexpected structure' + (ret ? JSON.stringify(ret) : ''),
  }
}

export function getEvaluateResult(ret: any): IEvaluteResult {
  if (!ret.result) {
    return createUnknownResult(ret)
  }

  const { result } = ret

  if (result.type === 'object' && result.subtype === 'error') {
    return {
      type: 'error',
      content: result.description,
    }
  }

  if (result.type !== 'string') {
    return createUnknownResult(ret)
  }

  return {
    type: 'success',
    content: result.value,
  }
}

export class Comm {
  public nodeVersion: string | null = null
  private pid: number | undefined = undefined
  private addr: string | undefined = undefined
  private handle: Communication
  private tcpProxy: null | TcpProxy = null
  private inspectorWorker: InspectorWorker | null = null
  private metric: Metric | null = null

  constructor(pid: number | undefined, addr: string | undefined) {
    if (!pid && !addr) {
      throw new DiatError(`invalid options`)
    }
    this.pid = pid
    this.addr = addr
    // TODO(oyyd): We need to handle `LiveInspector.close` at an appropriate time.
    this.handle = new Communication({
      pid: this.pid,
      inspectorAddr: this.addr,
    })
  }

  connect = async () => {
    const ret = await this.handle.connect()

    if (ret !== null) {
      this.nodeVersion = ret.version
    }
    return
  }

  releaseWs = () => {
    this.handle.releaseWs()
  }

  disconnect = (forceCloseInpsector: boolean = false) => {
    /* istanbul ignore next */
    if (this.inspectorWorker) {
      this.inspectorWorker.destroy()
      this.inspectorWorker = null
    }

    if (this.tcpProxy) {
      this.tcpProxy.destroy()
      this.inspectorWorker = null
    }

    if (this.metric) {
      this.metric.destroy()
      this.metric = null
    }

    // NOTE(oyyd): For Node.js 8, calling disconnect() might cause aborting.
    // TODO test
    if (
      !forceCloseInpsector &&
      this.nodeVersion &&
      isNodeVersionLE8(this.nodeVersion)
    ) {
      /* istanbul ignore next */
      return this.handle.disconnect(false)
    }

    return this.handle.disconnect()
  }

  private getPidOrZero = (): number => {
    return this.handle.getUsePid() ? (this.pid as number) : 0
  }

  takeHeapsnapshot = async (
    options_: Partial<ITakeHeapsnapshotOptions>
  ): Promise<IFileResult> => {
    const options = Object.assign(
      {
        // default
      },
      options_
    )
    const { file } = options

    const absPath = file
      ? getAbsolutePath(file)
      : getDefaultFileName(this.getPidOrZero(), kFileTypes.heapsnapshot)
    const fileStream = fs.createWriteStream(absPath)

    return new Promise<IFileResult>((resolve, reject) => {
      const addChunk = data => {
        const { chunk } = data
        fileStream.write(chunk)
      }

      this.handle.event.addListener(
        'HeapProfiler.addHeapSnapshotChunk',
        addChunk
      )
      this.handle.post('HeapProfiler.takeHeapSnapshot', null, (err, b) => {
        this.handle.event.removeListener(
          'HeapProfiler.addHeapSnapshotChunk',
          addChunk
        )
        fileStream.end()

        /* istanbul ignore next */
        if (err) {
          reject(err)
          return
        }
        resolve({
          file: absPath,
        })
      })
    })
  }

  cpuProfile = async (
    options_: Partial<IProfileOptions>
  ): Promise<IFileResult> => {
    const options = Object.assign(
      {
        duration: 5000,
        interval: 1000,
      },
      options_
    )

    const { file, duration, interval } = options

    if (typeof duration !== 'number') {
      throw new DiatError(
        `expect "duration" to be number, receive: ${duration}`
      )
    }

    const absPath = file
      ? getAbsolutePath(file)
      : getDefaultFileName(this.getPidOrZero(), kFileTypes.cpuprofile)
    const fileStream = fs.createWriteStream(absPath)

    const post = util.promisify(this.handle.post)

    await post('Profiler.enable', null)

    await post('Profiler.setSamplingInterval', { interval })

    await post('Profiler.start', null)

    await new Promise(resolve => setTimeout(resolve, duration))

    const res: any = await post('Profiler.stop', null)

    fileStream.write(JSON.stringify(res.profile))
    fileStream.end()

    return {
      file: absPath,
    }
  }

  heapProfile = async (
    options_: Partial<IProfileOptions>
  ): Promise<IFileResult> => {
    const options = Object.assign(
      {
        duration: 5000,
        interval: 1000,
      },
      options_
    )

    const { file, duration, interval } = options

    if (typeof duration !== 'number') {
      throw new DiatError(
        `expect "duration" to be number, receive: ${duration}`
      )
    }

    const absPath = file
      ? getAbsolutePath(file)
      : getDefaultFileName(this.getPidOrZero(), kFileTypes.heapprofile)
    const fileStream = fs.createWriteStream(absPath)

    const post = util.promisify(this.handle.post)

    await post('HeapProfiler.enable', null)

    await post('HeapProfiler.startSampling', {
      samplingInterval: interval,
    })

    await new Promise(resolve => setTimeout(resolve, duration))

    const res: any = await post('HeapProfiler.stopSampling', null)

    fileStream.write(JSON.stringify(res.profile))
    fileStream.end()

    return {
      file: absPath,
    }
  }

  heapTimeline = async (
    options_: Partial<IHeapTimelineOptions>
  ): Promise<IFileResult> => {
    const options = Object.assign(
      {
        track: true,
        duration: 5000,
      },
      options_
    )

    const { file, duration, track } = options

    if (typeof duration !== 'number') {
      throw new DiatError(
        `expect "duration" to be number, receive: ${duration}`
      )
    }

    const absPath = file
      ? getAbsolutePath(file)
      : getDefaultFileName(this.getPidOrZero(), kFileTypes.heaptimeline)
    const fileStream = fs.createWriteStream(absPath)

    const post = util.promisify(this.handle.post)

    await post('HeapProfiler.enable', null)

    const addChunk = data => {
      const { chunk } = data
      fileStream.write(chunk)
    }

    this.handle.event.addListener('HeapProfiler.addHeapSnapshotChunk', addChunk)

    await post('HeapProfiler.startTrackingHeapObjects', {
      trackAllocations: track,
    })

    await new Promise(resolve => setTimeout(resolve, duration))

    const res: any = await post('HeapProfiler.stopTrackingHeapObjects', null)

    fileStream.end()

    return {
      file: absPath,
    }
  }

  attachRepl = async (options: IAttachOptions) => {
    const wrapper = new NodeInspectWrapper(options)
    return wrapper.startInspect()
  }

  getMainThreadInspectorAddr = async (
    port: undefined | number
  ): Promise<{ host: undefined | string; port: undefined | number }> => {
    const usePid = this.handle.getUsePid()
    let targetHost: undefined | string = undefined
    let targetPort: undefined | number = undefined

    if (!usePid) {
      const addr = this.handle.getAddr() as any
      targetHost = addr.host
      targetPort = addr.port
    }

    if (port) {
      targetPort = port
    }

    return {
      host: targetHost,
      port: targetPort,
    }
  }

  openInspect = async (
    options: IOpenInspectOptions = {}
  ): Promise<IOpenInspectInfo> => {
    const port = options.port || 9229
    const tcpProxyOptions: Partial<ITcpProxyOptions> = {}

    // for Node.js 8, only one ws could connect at a time
    if (this.nodeVersion && isNodeVersionLE8(this.nodeVersion)) {
      this.releaseWs()
    }

    const {
      host: targetHost,
      port: targetPort,
    } = await this.getMainThreadInspectorAddr(port)
    tcpProxyOptions.targetHost = targetHost
    tcpProxyOptions.targetPort = targetPort

    this.tcpProxy = new TcpProxy(tcpProxyOptions)
    const addr = await this.tcpProxy.listen()

    const info = {
      ...addr,
      tcpProxy: this.tcpProxy,
    }
    return info
  }

  /**
   * required Node.js >= 10.12
   */
  getWorkers = async () => {
    // get worker infos -> choose worker -> proxy inspecting
    if (!this.inspectorWorker) {
      const post: IPostFunc = util.promisify(this.handle.post)
      this.inspectorWorker = new InspectorWorker({
        event: this.handle.event,
        post: post,
      })
    }

    const infos = await this.inspectorWorker.getWorkers()

    return infos
  }

  inspectWorker = async (sessionId: string) => {
    if (!this.inspectWorker) {
      throw new Error('expect "this.inspectWorker"')
    }

    const { inspectorWorker } = this
    if (!inspectorWorker) {
      return
    }

    const addr = await inspectorWorker.createWorkerSession(sessionId)
    return addr
  }

  run = async (name: string, options?: any): Promise<IEvaluteResult> => {
    const code = await snippets.getSnippet(name, options)
    return this.exec(code)
  }

  exec = async (code: string) => {
    const ret = await this.handle.execCode(code)
    return getEvaluateResult(ret)
  }

  startMetric = async (
    options: { socketPath?: string } = {}
  ): Promise<Metric> => {
    const { socketPath: p } = options
    assert(!this.metric, 'this.metric already exist')

    this.metric = p
      ? new Metric({
          socketPath: p,
        })
      : new Metric({})

    const socketPath = await this.metric.createServer()

    this.metric.once('close', () => {
      // TODO
    })

    await this.run('metric_collect', {
      socketPath,
    })

    return this.metric
  }
}
