import * as WebSocket from 'ws';
import fetch from 'node-fetch';
import { wait } from './utils';
import { LiveInspectorError } from './Error';
import { IAddr } from './Types';
import { TcpDetector } from './TcpDetector';

interface IOptions {
  retryTimes: number;
  retryInterval: number;
  inspectPort: number;
}

const kDefaultOptions = {
  retryTimes: 2,
  retryInterval: 1000,
  inspectPort: 9229
};

export function killPid(pid: number, signal: string) {
  try {
    process.kill(pid, signal);
  } catch (err) {
    throw new LiveInspectorError(
      `Failed to send signal to pid: ${pid}, is the process still alive?`
    );
  }
}

export class ProcessInspectPort {
  private options: IOptions;

  constructor(options: Partial<IOptions>) {
    this.options = Object.assign({}, kDefaultOptions, options);
  }

  private getMeta = async (httpUrl: string): Promise<any> => {
    const uri = `${httpUrl}/json`;
    const ret = await fetch(uri);
    const meta = await ret.json();

    return meta;
  };

  private verifyInspectorPort = async (
    httpUrl: string,
    retryTime: number = 0
  ): Promise<string | null> => {
    const { retryInterval, retryTimes } = this.options;

    try {
      const meta = await this.getMeta(httpUrl);
      if (
        Array.isArray(meta) &&
        meta.length > 0 &&
        meta[0].webSocketDebuggerUrl
      ) {
        return meta[0].webSocketDebuggerUrl;
      }
      return null;
    } catch (err) {}

    if (retryTime >= retryTimes) {
      return null;
    }

    await wait(retryInterval);
    return this.verifyInspectorPort(httpUrl, retryTime + 1);
  };

  private wsConnect = async (wsURI: string): Promise<WebSocket> => {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsURI);

      const removeListener = () => {
        ws.removeListener('open', waitReady);
        ws.removeListener('close', waitFail);
      };

      const waitReady = () => {
        removeListener();
        resolve(ws);
      };

      // TODO type
      const waitFail = (code, reason) => {
        removeListener();
        reject(
          new LiveInspectorError(
            `failed to connect to the ws: ${wsURI}, code: ${code}, reason: ${reason}`
          )
        );
      };

      ws.once('open', waitReady);
      ws.once('close', waitFail);
    });
  };

  /**
   * 让一个进程开启开启inspect端口
   * - 发送SIGUSR1信号
   * - (多次)试探9229端口是否接受ws请求
   */
  public connectByPid = async (pid: number): Promise<WebSocket> => {
    const { inspectPort } = this.options;
    const httpUrl = `http://127.0.0.1:${inspectPort}`;

    const connected = await TcpDetector.detectPort(inspectPort);

    // 如果端口没有被占用，则直接发送信号
    if (!connected) {
      killPid(Number(pid), 'SIGUSR1');
    }

    const ret = await this.verifyInspectorPort(httpUrl);

    if (!ret) {
      const msg = connected
        ? `port ${inspectPort} has been occupied by another process`
        : `failed to open the inspect port for process of ${pid}`;

      throw new LiveInspectorError(msg);
    }

    const ws = await this.wsConnect(ret);
    return ws;
  };

  public connectByAddr = async (addr: IAddr): Promise<WebSocket> => {
    const httpUrl = `http://${addr.host}:${addr.port}`;

    const ret = await this.verifyInspectorPort(httpUrl);

    if (!ret) {
      throw new LiveInspectorError(
        `failed to open the inspect service at: ${addr.host}:${addr.port}`
      );
    }

    const ws = await this.wsConnect(ret);
    return ws;
  };
}
