import * as path from 'path'
import * as semver from 'semver'
import fetch from 'node-fetch'
import * as os from 'os'

export type GetProxyUrlType = (
  url: string
) => Promise<string | null | { completeUrl: string }>

const kPublicIpPlaceholder = '0.0.0.0'

export function getAbsolutePath(file: string): string {
  if (path.isAbsolute(file)) {
    return file
  }

  return path.resolve(process.cwd(), file)
}

export function getDefaultFileName(pid: number, type: string): string {
  let pidPart = ''

  if (pid) {
    pidPart = `_${pid}`
  }
  return path.resolve(process.cwd(), `./diat${pidPart}_${Date.now()}${type}`)
}

export function isNodeVersionLE8(
  version: string | null = process.version
): boolean {
  if (!version) {
    return false
  }
  return semver.satisfies(version, '<9')
}

const kDevtoolsUrl = `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=`

export async function getFirstSessionURL(
  host: string,
  port: number,
  ip: string | null,
  getProxyUrl?: GetProxyUrlType
): Promise<string> {
  ip = ip || kPublicIpPlaceholder
  const res = await fetch(`http://${host}:${port}/json`)
  const meta = await res.json()

  // 在低版本上，可能没有这个数据
  if (!Array.isArray(meta) || meta.length === 0) {
    throw new Error('invalid meta')
  }

  const { id } = meta[0]

  if (!id) {
    throw new Error('invalid meta')
  }

  let addr = `${ip}:${port}/${id}`

  if (typeof getProxyUrl === 'function') {
    /**
     * If the typeof value that "getProxyUrl" returns is a:
     * - url, it's regarded as the "ws" part
     * - null, use the default url
     * - object with "completeUrl" key, it's regarded as the url
     */
    const proxyUrl = await getProxyUrl(addr)
    if (typeof proxyUrl === 'string') {
      addr = proxyUrl
    } else if (
      proxyUrl &&
      typeof proxyUrl === 'object' &&
      proxyUrl.completeUrl
    ) {
      return proxyUrl.completeUrl
    }
  }

  return `${kDevtoolsUrl}${addr}`
}

export function getPublicIP(): Promise<string | null> {
  const interfaces = os.networkInterfaces()

  if (Array.isArray(interfaces.en0) && interfaces.en0.length > 0) {
    const { en0 } = interfaces
    const ipv4Item = en0.find((i) => i.family === 'IPv4')
    if (ipv4Item) {
      return Promise.resolve(ipv4Item.address)
    }
  }

  return Promise.resolve(null)
}

export function parseInspectorUrl(
  wsUrl: string
): { address: string; host: string; port: number } | null {
  if (typeof wsUrl !== 'string') {
    return null
  }

  const ret = /ws\:\/\/(.+)\:(\d+)/.exec(wsUrl)

  if (!ret) {
    return null
  }

  const host = ret[1]
  const port = Number(ret[2])
  const address = `${host}:${port}`
  return {
    host,
    port,
    address,
  }
}
