import chalk from 'chalk'
import * as inquirer from 'inquirer'
import { Comm } from './Comm'
import { logger } from './Logger'
import { LinuxPerf } from './LinuxPerf'
import { StackVis } from './StackVis'
import { IUploadFileFunc } from './Types'
import { uploadFile } from './upload'
import { getFirstSessionURL, getPublicIP } from './utils'

type GetPublicIP = () => Promise<string | null>

interface ICLIOptions {
  uploadFile?: IUploadFileFunc
  getPublicIP: GetPublicIP
}

const kExitTips = 'press ctrl/meta+c to exit'

function throwInNextTick(err: any) {
  setTimeout(() => {
    if (err._type === 'live_inspector' || err._type === 'diat') {
      console.error(err.message)
    } else {
      console.error(err.stack)
    }
    process.exit(1)
  }, 0)
}

function logUploadResult(result) {
  if (result.nemoUrl) {
    logger.log(`analyse with devtools: ${chalk.cyan(result.nemoUrl)}`)
  }
  logger.log(`raw file: ${chalk.cyan(result.url)}`)
}

function validateAddr(addr: string): boolean {
  return /^.+\:\d+$/.test(addr)
}

function createComm(argv): Comm | null {
  const { p, a } = argv
  if (!p && !a) {
    logger.error('expect -p(pid) or -a(inspector_addr) option')
    return null
  }

  if (!p && !validateAddr(a)) {
    logger.error('invalid inspector_addr, expected format: 127.0.0.1:9229')
    return null
  }

  return new Comm(p, a)
}

function handleSigint(func) {
  process.on('SIGINT', async () => {
    await func()
  })
}

async function getActiveHandles(argv) {
  const comm = createComm(argv)
  if (!comm) {
    return
  }

  try {
    await comm.connect()
    const ret = await comm.run('get_active_handles')
    if (ret.type === 'error') {
      logger.log(`getactivehandles failed, reason: ${ret.content}`)
    } else {
      logger.log(JSON.stringify(JSON.parse(ret.content), null, 2))
    }
    await comm.disconnect()
  } catch (err) {
    throwInNextTick(err)
  }
}

async function togglePerfBasicProf(argv) {
  const linuxPerf = new LinuxPerf()
  const modulePath = linuxPerf.getModulePath()

  if (!modulePath) {
    logger.log(
      'The installation of "linux-perf" failed, make sure your Node.js >= 10 to use perbasicprof.'
    )
    return
  }

  const { enable: enableStr } = argv

  if (enableStr !== 'true' && enableStr !== 'false') {
    logger.log('the value of -e should be exact "true" or "false"')
    return
  }
  const enable = enableStr === 'true'
  const comm = createComm(argv)
  if (!comm) {
    return
  }

  try {
    await comm.connect()
    const ret = await comm.run('toggle_perf_basic_prof', {
      enable,
      modulePath,
    })
    if (ret.type === 'error') {
      logger.log(`perfbasicprof failed, reason: ${ret.content}`)
    } else {
      const res = JSON.parse(ret.content)

      if (res.operationReturn) {
        if (enable) {
          logger.log(`generating /tmp/perf-${res.pid}.map`)
        } else {
          logger.log('stop generating the .map file')
        }
      } else {
        logger.log(
          `operation has no effect, is the --perf-basic-prof already ${
            enable ? 'on' : 'off'
          }?`
        )
      }
    }
    await comm.disconnect()
  } catch (err) {
    throwInNextTick(err)
  }
}

async function startMetric(argv) {
  const { s } = argv
  try {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    await comm.connect()

    logger.log('waiting for connection..')
    const metric = await comm.startMetric({
      socketPath: s,
    })

    metric.once('get_closed', () => {
      logger.log('socket gets closed')
    })

    handleSigint(async () => {
      await comm.disconnect()
      process.exit(0)
    })
  } catch (err) {
    throwInNextTick(err)
  }
}

async function perf2svg(args) {
  const { file, svg } = args
  const vis = new StackVis()
  try {
    const output = await vis.perfStackToSvg(file, svg)
    logger.log(`create: ${output}`)
  } catch (err) {
    throwInNextTick(err)
  }
}

const pidOption = {
  alias: 'pid',
  demandOption: false,
  describe: 'Target pid of your Node.js process.',
  type: 'number',
}
const inspectorAddrOption = {
  alias: 'inspector_addr',
  demandOption: false,
  describe:
    'The "inspect" address of your Node.js process, e.g. 127.0.0.1:9229',
  type: 'string',
}
const entryOptions = {
  p: pidOption,
  a: inspectorAddrOption,
}

function createProfileOptions(type) {
  const profileOptions = {
    d: {
      alias: 'duration',
      demandOption: false,
      describe: 'How long the profiling will last, unit: ms.',
      default: 5000,
      type: 'number',
    },
    i: {
      alias: 'interval',
      demandOption: false,
      describe: 'Sampling interval, unit: us.',
      default: 1000,
      type: 'number',
    },
    f: {
      alias: 'file',
      demandOption: false,
      describe: `Where ${type} write to, default: "./diat_$PID_$TS.${type}"`,
      type: 'string',
    },
  }

  return profileOptions
}

const replOptions = {
  r: {
    alias: 'repl',
    demandOption: false,
    describe: 'Attach the inspector server with node-inspect.',
    type: 'boolean',
    default: false,
  },
}
const gzipOpts = {
  g: {
    alias: 'gzip',
    demandOption: false,
    describe: 'Use gzip to compress files.',
    type: 'boolean',
    default: false,
  },
}

export class CLI {
  private options: ICLIOptions

  constructor(options: ICLIOptions) {
    this.options = options
  }

  private uploadWithArgs = async (args: { file: string; gzip: boolean }) => {
    const { uploadFile } = this.options

    if (!uploadFile) {
      throw new Error('expect uploadFile()')
    }

    const { file, gzip } = args
    try {
      const ret = await uploadFile(file, gzip)
      logUploadResult(ret)
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private upload = async (argv) => {
    const { file, gzip } = argv
    return this.uploadWithArgs({ file, gzip })
  }

  private cpuProfile = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    const { file, duration, upload, gzip } = argv

    try {
      await comm.connect()
      logger.log('profiling...')
      const ret = await comm.cpuProfile({
        file,
        duration,
      })
      logger.log(`cpuprofile generated at: ${ret.file}`)
      if (upload) {
        await this.uploadWithArgs({
          file: ret.file,
          gzip,
        })
      }
      await comm.disconnect()
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private heapProfile = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    const { file, duration, interval, upload, gzip } = argv

    try {
      await comm.connect()
      logger.log('profiling...')
      const ret = await comm.heapProfile({
        file,
        duration,
        interval,
      })
      logger.log(`heapprofile generated at: ${ret.file}`)
      if (upload) {
        await this.uploadWithArgs({
          file: ret.file,
          gzip,
        })
      }
      await comm.disconnect()
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private heapTimeline = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    const { file, duration, track, upload, gzip } = argv

    try {
      await comm.connect()
      logger.log('profiling...')
      const ret = await comm.heapTimeline({
        file,
        duration,
        track,
      })
      logger.log(`heaptimeline generated at: ${ret.file}`)
      if (upload) {
        await this.uploadWithArgs({
          file: ret.file,
          gzip,
        })
      }
      await comm.disconnect()
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private takeHeapsnapshot = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    const { file, upload, gzip } = argv

    try {
      await comm.connect()
      logger.log('taking heapsnapshot...')
      const ret = await comm.takeHeapsnapshot({
        file,
      })
      logger.log(`heapsnapshot generated at: ${ret.file}`)
      if (upload) {
        await this.uploadWithArgs({
          file: ret.file,
          gzip,
        })
      }
      await comm.disconnect()
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private logInspectorPort = async (
    isWorker: boolean,
    host: string,
    port: number
  ) => {
    const { getPublicIP } = this.options
    const ip = await getPublicIP()
    const url = await getFirstSessionURL(host, port, ip)
    const hostPart = chalk.cyan(url)
    const addrPart = chalk.cyan(`${host}:${port}`)
    logger.log(
      `inspector server${
        isWorker ? ' of the worker' : ''
      } is listening on: ${addrPart}\nopen the url below on your Chrome to debug: ${hostPart}`
    )
    logger.log(kExitTips)
  }

  private attachRepl = async (
    comm: Comm,
    host: string = '127.0.0.1',
    port: number = 9229
  ) => {
    await comm.attachRepl({
      host,
      port,
    })
    await comm.disconnect()
    process.exit(0)
  }

  private inspect = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    const { port: proxyPort, repl } = argv
    try {
      await comm.connect()
      if (repl) {
        const { host, port } = await comm.getMainThreadInspectorAddr(proxyPort)
        await this.attachRepl(comm, host, port)
        return
      }
      const { host, port, tcpProxy } = await comm.openInspect({
        port: proxyPort,
      })
      await this.logInspectorPort(false, host, port)
      tcpProxy.once('close', (inspectorClosed) => {
        // get closed because the inspector server has exited
        if (inspectorClosed) {
          logger.log('inspector server exited')
        }
      })
      // wait signal to exit
      handleSigint(async () => {
        await comm.disconnect()
        process.exit(0)
      })
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private inspectWorker = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }
    const { repl = false } = argv

    try {
      await comm.connect()
      const workers = await comm.getWorkers()
      if (workers.length === 0) {
        logger.warn('no workers found in the process')
        await comm.disconnect()
        return
      }
      const ret = await inquirer.prompt([
        {
          type: 'list',
          name: 'slectedWorker',
          message: 'Choose a worker to inspect',
          choices: workers.map((i) => {
            const { workerId, title, url } = i.workerInfo
            return {
              name: `${title}(id: ${workerId}) [${url}]`,
              value: i.sessionId,
            }
          }),
        },
      ])
      const { slectedWorker } = ret
      const addr = await comm.inspectWorker(slectedWorker)
      if (!addr) {
        throw new Error('unexpected addr')
      }
      const { host, port } = addr
      if (repl) {
        await this.attachRepl(comm, host, port)
        return
      }
      await this.logInspectorPort(true, host, port)
      // wait signal to exit
      handleSigint(async () => {
        await comm.disconnect()
        process.exit(0)
      })
    } catch (err) {
      throwInNextTick(err)
    }
  }

  private inspectstop = async (argv) => {
    const comm = createComm(argv)
    if (!comm) {
      return
    }

    await comm.connect()

    await comm.disconnect(true)
  }

  main = async () => {
    const { uploadFile } = this.options
    // TODO
    const hasuploadFunction = typeof uploadFile === 'function' && false
    const uploadOpts = hasuploadFunction
      ? {
          u: {
            alias: 'upload',
            demandOption: false,
            describe: `Upload the file when it's finished.`,
            type: 'boolean',
            default: false,
          },
          ...gzipOpts,
        }
      : {}

    const yargs = require('yargs')

    yargs.command(
      'inspect',
      'diat inspect -p=<pid>\nActivate inspector and forward it for a public IP.\n**Warning**: binding inspector to a public IP:port combination is insecure.',
      (yargs) => {
        yargs.options({
          port: {
            demandOption: false,
            describe:
              'The port to be listened by inspector server, default: 0.',
            type: 'number',
          },
          ...replOptions,
          ...entryOptions,
        })
      },
      this.inspect
    )

    yargs.command(
      'inspectworker',
      'diat inspectworker -p=<pid>\nAs same as "inspect" but for a worker inside the process.',
      (yargs) => {
        yargs.options({
          ...replOptions,
          ...entryOptions,
        })
      },
      this.inspectWorker
    )

    yargs.command(
      'inspectstop',
      'diat inspectstop -a=<address>\nStop the inspector server of a Node.js process.',
      (yargs) => {
        yargs.option({
          ...entryOptions,
        })
      },
      this.inspectstop
    )

    yargs.command(
      'metric',
      'diat metric -p=<pid>\nLog basic resource usage of the process.',
      (yargs) => {
        yargs.option({
          ...entryOptions,
          s: {
            alias: 'socket_path',
            demandOption: false,
            describe:
              'The name of pipe socket waiting for connections of the process, default: "diat_metrics.sock".',
            type: 'string',
          },
        })
      },
      startMetric
    )

    yargs.command(
      'cpuprofile',
      'diat cpuprofile -p=<pid> [<args>]\nStart cpu profile for a process.',
      (yargs) => {
        yargs.options({
          ...createProfileOptions('cpuprofile'),
          ...entryOptions,
          ...uploadOpts,
        })
      },
      this.cpuProfile
    )

    yargs.command(
      'heapsnapshot',
      'diat heapsnapshot -p=<pid> [<args>]\nTake the heapsnapshot of a process.',
      (yargs) => {
        yargs.options({
          f: {
            alias: 'file',
            demandOption: false,
            describe:
              'Where heapsnapshot write to, default: "./diat_$PID_$TS.heapsnapshot".',
            type: 'string',
          },
          ...entryOptions,
          ...uploadOpts,
        })
      },
      this.takeHeapsnapshot
    )

    yargs.command(
      'heapprofile',
      'diat heapprofile -p=<pid> [<args>]\nStart heap profile for a process.',
      (yargs) => {
        yargs.options({
          ...createProfileOptions('heapprofile'),
          ...entryOptions,
          ...uploadOpts,
        })
      },
      this.heapProfile
    )

    yargs.command(
      'heaptimeline',
      'diat heaptimeline -p=<pid> [<args>]\nStart tracking heap objects for a process.',
      (yargs) => {
        yargs.options({
          d: {
            alias: 'duration',
            demandOption: false,
            describe: 'How long the profiling will last, unit: ms.',
            default: 5000,
            type: 'number',
          },
          f: {
            alias: 'file',
            demandOption: false,
            describe: `Where heaptimeline write to, default: "./diat_$PID_$TS.heaptimeline"`,
            type: 'string',
          },
          t: {
            alias: 'track',
            demandOption: false,
            describe: 'Enable "trackAllocations".',
            default: true,
            type: 'boolean',
          },
          ...entryOptions,
          ...uploadOpts,
        })
      },
      this.heapTimeline
    )

    if (hasuploadFunction) {
      yargs.command(
        'upload',
        'diat upload -f=<filename>\nUpload a .cpuprofile/.heapsnapshot file for later inspecting.',
        (yargs) => {
          yargs.options({
            f: {
              alias: 'file',
              demandOption: true,
              describe: 'The path of file to upload.',
              type: 'string',
            },
            ...gzipOpts,
          })
        },
        this.upload
      )
    }

    yargs.command(
      'perfbasicprof',
      `diat perfbasicprof -p=<pid> -e=true|false\n` +
        `Toggle --perf-basic-prof to enable or disable generating /tmp/perf-$PID.map file for perf profiling.`,
      (yargs) => {
        yargs.options({
          ...entryOptions,
          e: {
            alias: 'enable',
            demandOption: true,
            describe: 'Enable or disable generating of the map file.',
            type: 'string',
          },
        })
      },
      togglePerfBasicProf
    )

    yargs.command(
      'perf2svg',
      `diat perf2svg -f=<perf_script_file> [<args>]\n` +
        'Parse the output of perf-script into a svg.',
      (yargs) =>
        yargs.options({
          f: {
            alias: 'file',
            demandOption: true,
            describe: 'File name of the output generated by perf-script.',
            type: 'string',
          },
          s: {
            alias: 'svg',
            demandOption: false,
            describe: 'File name which svg content will be written into.',
            type: 'string',
            default: 'diat_perf.svg',
          },
        }),
      perf2svg
    )

    // yargs.command(
    //   'getactivehandles',
    //   `diat getactivehandles -p=<pid>\nGet active handles of a Node.js process.`,
    //   yargs => {
    //     yargs.options({
    //       ...entryOptions
    //     });
    //   },
    //   getActiveHandles
    // );

    yargs
      .usage('usage: diat <command> [<args>]')
      .options({
        // global options
      })
      .scriptName('diat')
      .help()
      .locale('en')
      .demandCommand()
      .strict()
      .parse()
  }
}

export const main = () => {
  const cli = new CLI({
    getPublicIP,
    uploadFile,
  })
  return cli.main()
}

if (require.main === module) {
  main()
}
