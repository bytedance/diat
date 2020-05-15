import * as os from 'os'
import * as childProcess from 'child_process'
import * as path from 'path'

interface IPerfRecordOptions {
  pid: number
  freq: number
  duration: number
}

interface IPerfScriptOptions {
  dataFile: string
  outputFile: string
}

async function checkPerf(): Promise<boolean> {
  if (os.platform() !== 'linux') {
    return false
  }

  return new Promise((resolve) => {
    const child = childProcess.exec('perf --version')

    child.on('exit', (code) => {
      resolve(code === 0)
    })
  })
}

function getAbsolutePath(filename): string {
  if (path.isAbsolute(filename)) {
    return filename
  }

  return path.resolve(process.cwd(), filename)
}

function getFilename(pid: number): string {
  return `perf_${pid}.data`
}

function getOutputFileName(dataFile: string): string {
  return `${dataFile}.out`
}

export class Perf {
  static perfExist: any

  static hasPerf = async (): Promise<boolean> => {
    if (Perf.perfExist === undefined) {
      Perf.perfExist = await checkPerf()
    }

    return Perf.perfExist
  }

  /**
   * perf record -F 1000 -p <PID> -g -m 512B -- sleep 5
   * -F, --freq= Profile at this frequency.
   * -p, --pid= Record events on existing process ID (comma separated list).
   * -g, --call-graph Do call-graph (stack chain/backtrace) recording.
   * -m, --mmap-pages= Number of mmap data pages. Must be a power of two.
   * -o, --output= Output file name.
   */
  static record = async (
    opts: Partial<IPerfRecordOptions>
  ): Promise<string> => {
    if (!(await Perf.hasPerf())) {
      throw new Error('failed to find "perf"')
    }
    if (!opts.pid) {
      throw new Error('Perf.record expect "pid"')
    }
    const options = Object.assign(
      {
        freq: 1000,
        duration: 5000,
      },
      opts
    )

    const { pid, freq, duration } = options
    const durationInSeconds = Math.ceil(duration / 1000)

    if (durationInSeconds <= 0) {
      throw new Error(`Perf.record duration is too small, value: ${duration}`)
    }

    // TODO support choosing a thread
    // TODO add timeout
    return new Promise((resolve, reject) => {
      const filename = getFilename(pid as number)
      const cmd = `perf record -F ${freq} -p ${pid} -g -o ${filename} -- sleep ${durationInSeconds}`
      const child = childProcess.exec(cmd)

      child.stdout?.pipe(process.stdout)
      child.stderr?.pipe(process.stderr)

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(getAbsolutePath(filename))
          return
        }

        reject(new Error(`Perf.record failed, code: ${code}`))
      })
    })
  }

  static script = async (
    options: Partial<IPerfScriptOptions>
  ): Promise<string> => {
    if (!(await Perf.hasPerf())) {
      throw new Error('failed to find "perf"')
    }

    const { dataFile } = options

    if (!dataFile) {
      throw new Error(`Perf.script receive invalid "dataFile": ${dataFile}`)
    }

    const outputFile = options.outputFile || getOutputFileName(dataFile)

    return new Promise((resolve, reject) => {
      const child = childProcess.exec(
        `perf script -i ${dataFile} > ${outputFile}`
      )

      child.stdout?.pipe(process.stdout)
      child.stderr?.pipe(process.stderr)

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(getAbsolutePath(outputFile))
          return
        }

        reject(new Error(`Perf.script failed, code: ${code}`))
      })
    })
  }
}
