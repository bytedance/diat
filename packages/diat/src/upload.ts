import * as http from 'http'
import * as fs from 'fs'
import * as zlib from 'zlib'
import * as urlModule from 'url'
import { Writable, Readable } from 'stream'
import * as path from 'path'
import { promisify } from 'util'
import { DiatError } from './Error'
import { getAbsolutePath } from './utils'

const k1KB = 1024
const kRetryTimes = 3
const kTimeout = 0

interface UploadFileOpts {
  filename: string
  filepath: string
  prefix: string
  uploadRoutes: {
    uploadDirectlyRoute: string
  }
  size?: number
  gzip?: boolean
}

type UploadFileRet = {
  url: string
  uniqueId: string
}

const safeJSON = (str: string) => {
  try {
    const json = JSON.parse(str)
    return json
  } catch (error) {
    return str
  }
}

async function retry<T>(
  fn: () => Promise<T>,
  times = 0,
  timeout = 0
): Promise<T> {
  if (times === 0) {
    throw new DiatError('retry times have been used up!')
  }

  try {
    const promises = [fn()]
    if (timeout > 0) {
      promises.push(
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DiatError(`timeout: ${timeout}`))
          }, timeout)
        })
      )
    }
    const ret = await Promise.race(promises)
    return Promise.resolve(ret)
  } catch (err) {
    if (times === 1) {
      throw err
    }

    return retry(fn, times - 1, timeout)
  }
}

async function request<T>(
  url: string,
  options: any,
  contentStream: Readable | Buffer | null
): Promise<T> {
  return new Promise((resolve, reject) => {
    let error: null | Error = null
    let ret: null | string = null
    let hasFinished = false

    const finish = () => {
      if (hasFinished) {
        return
      }

      hasFinished = true
      if (error) {
        reject(error)
        return
      }

      if (ret) {
        resolve(safeJSON(ret))
        return
      }

      resolve()
    }

    const urlInfo = urlModule.parse(url)
    const requestOptions = Object.assign({}, options, urlInfo)
    const req = http.request(requestOptions, res => {
      const bufs: Buffer[] = []
      res.on('data', data => {
        bufs.push(data)
      })
      res.on('error', err => {
        error = err
        finish()
      })
      res.on('end', () => {
        const buf = Buffer.concat(bufs)
        ret = buf.toString('utf8')
        if (res.statusCode && res.statusCode < 400) {
          finish()
        } else {
          error = new DiatError(
            `request failed, statusCode: ${res.statusCode}, msg: ${ret}`
          )
          finish()
        }
      })
    })

    req.on('error', err => {
      error = err
      finish()
    })

    if (!contentStream) {
      req.end()
    } else if (Buffer.isBuffer(contentStream)) {
      req.end(contentStream)
    } else {
      contentStream.pipe(req)
    }
  })
}

async function uploadDirectlyOnce(
  opts: Omit<Required<UploadFileOpts>, 'gzip'>
): Promise<UploadFileRet> {
  const { filename, filepath, prefix, uploadRoutes, size } = opts
  const url = `${prefix}${uploadRoutes.uploadDirectlyRoute}?filename=${filename}`

  const fileStream = fs.createReadStream(filepath)

  const hasErr = new Promise((resolve, reject) => {
    fileStream.on('error', err => {
      reject(err)
    })

    // fileStream.on('end', () => {
    //   resolve();
    // });
  })

  const ret = await Promise.race([
    hasErr,
    request<UploadFileRet>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Length': size,
        },
      },
      fileStream
    ),
  ])

  // @ts-ignore
  return ret
}

const uploadDirectly = async (
  opts: Omit<Required<UploadFileOpts>, 'gzip'>
): Promise<UploadFileRet> => {
  return retry(async () => uploadDirectlyOnce(opts), kRetryTimes, kTimeout)
}

function createGzippedFileStream(filepath: string): Writable {
  const fileStream = fs.createReadStream(filepath)
  const gzippedStream = zlib.createGzip()
  fileStream.pipe(gzippedStream)
  return gzippedStream
}

const duplicateGzipFile = async (filepath: string): Promise<string> => {
  // 确保文件存在
  await promisify(fs.stat)(filepath)
  const duplicatedFilepath = `${filepath}.gz`
  const gzippedStream = createGzippedFileStream(filepath)
  const writableStream = fs.createWriteStream(duplicatedFilepath)
  gzippedStream.pipe(writableStream)
  await new Promise(resolve => {
    gzippedStream.on('end', () => {
      resolve()
    })
  })
  return duplicatedFilepath
}

async function upload(opts: UploadFileOpts): Promise<UploadFileRet> {
  let filename = opts.filename
  let filepath = opts.filepath
  // 获取文件文件长度
  let stats = await promisify(fs.stat)(filepath)
  let size = stats.size

  // 体积大于 1k 时，创建gzip文件
  if (opts.gzip && size > k1KB) {
    filepath = await duplicateGzipFile(filepath)
    filename = `${filename}.gz`
    stats = await promisify(fs.stat)(filepath)
    size = stats.size
  }

  const newUploadOpts = {
    ...opts,
    filename,
    filepath,
    size,
  }

  return uploadDirectly(newUploadOpts)
}

export async function uploadFile(file: string, gzip?: boolean) {
  // TODO 应该要配置地址
  const prefix = `http://localhost:4422`
  const filepath = getAbsolutePath(file)
  const filename = path.basename(filepath)
  const extname = path.extname(filepath)

  const ret = await upload({
    filename,
    filepath,
    prefix,
    uploadRoutes: {
      uploadDirectlyRoute: '/file/upload',
    },
    gzip,
  })

  let nemoUrl: string | null = null

  switch (extname) {
    case '.heapsnapshot':
    case '.cpuprofile': {
      // nemoUrl = `${kDevtoolsPrefix}?${qs.stringify({
      //   fetchprefix,
      //   fileid: ret.uniqueId,
      //   filename,
      //   uuid: 'uuid'
      // })}`;
    }
    default:
  }

  return Object.assign({
    ...ret,
    url: `${prefix}${ret.url}`,
    nemoUrl,
  })
}
