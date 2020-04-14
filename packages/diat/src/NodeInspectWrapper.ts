import * as nodeInspect from 'diat-node-inspect/lib/_inspect.js'

interface IOptions {
  host: string
  port: number
}

function getDefaultOptions(): IOptions {
  return {
    host: '127.0.0.1',
    port: 9229,
  }
}

export class NodeInspectWrapper {
  private options: IOptions
  private instance: any = null
  /**
   * We always pass then host and port to node-inspect:
   * node-inspect ip:port
   */
  constructor(options: IOptions = getDefaultOptions()) {
    this.options = options
  }

  startInspect = () => {
    return new Promise(resolve => {
      const { host, port } = this.options

      const argv = [`${host}:${port}`]

      this.instance = nodeInspect.start(argv)
      this.instance.on('replExit', () => {
        resolve()
      })
    })
  }

  destroy = () => {
    //
  }
}
