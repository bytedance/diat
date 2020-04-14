import * as assert from 'assert';
import * as debug_ from 'debug';
import * as WebSocket from 'ws';
import { promisify } from 'util';
import { EventEmitter as Event } from 'events';
import { ProcessInspectPort } from './ProcessInspectPort';
import { LiveInspectorError } from './Error';
import { IAddr } from './Types';

interface IOptions {
  pid?: number;
  inspectorAddr?: string;
  getBasicInfoTimeout: number;
}

interface IConnectRet {
  pid: number;
  version: string;
}

const debug = debug_('live-inspector')

const kDefaultEvaluateOptions = {
  awaitPromise: true,
  includeCommandLineAPI: true
};

const kDefaultOptions = {
  getBasicInfoTimeout: 1000
};

const kDomain = 'LiveInspector';

function parseAddrStr(str: string): IAddr | null {
  const ret = /^(.+)\:(\d+)$/.exec(str);

  if (!ret) {
    return null;
  }

  return {
    host: ret[1],
    port: parseInt(ret[2], 10)
  };
}

export class Communication {
  private options: IOptions;
  private processInspectPort: ProcessInspectPort;
  private ws: WebSocket | null = null;
  private msgId: number = 0;
  private msgCallback: Map<number, (err: any, result: any) => {}> = new Map();
  private usePid: boolean;
  private addr: IAddr | null = null;

  public event = new Event();

  constructor(options: Partial<IOptions>) {
    this.options = Object.assign({}, kDefaultOptions, options);
    if (!this.options.inspectorAddr && !this.options.pid) {
      throw new LiveInspectorError('expect "inspectorAddr" or "pid"');
    }
    const { pid, inspectorAddr } = this.options;
    this.usePid = Boolean(pid);

    if (!this.usePid) {
      const ret = parseAddrStr(inspectorAddr as string);
      if (!ret) {
        throw new Error(`invalid "inspectorAddr": ${inspectorAddr}`);
      }
      this.addr = ret;
    }

    this.processInspectPort = new ProcessInspectPort({});
  }

  public getUsePid = () => this.usePid;
  public getAddr = () => this.addr;

  private isWsAlive = (): boolean => Boolean(this.ws);

  private checkWs = (): WebSocket => {
    const { ws } = this;
    assert(ws, 'expect connect() before post()');

    return ws as WebSocket;
  };

  public post = (method: string, params: any, callback: any) => {
    const id = this.msgId++;

    const msgObj: any = {
      id,
      method
    };

    if (params) {
      msgObj.params = params;
    }

    this.checkWs().send(JSON.stringify(msgObj));

    if (typeof callback === 'function') {
      this.msgCallback.set(id, callback);
    }
  };

  // 结构：{ result: { type: 'string', value: 'v10.16.0' } }
  public execCode = async (
    expression: string,
    timeout: number = 0
  ): Promise<any> => {
    let ret: any = null;
    let err: any = null;

    const post = promisify(this.post);

    await post('Runtime.enable', null);

    // 有可能因为线程阻塞导致执行的代码无法返回，因此这里需要限制时间
    const evaluatePromise = post(
      'Runtime.evaluate',
      Object.assign({}, kDefaultEvaluateOptions, {
        expression
      })
    );

    if (timeout > 0) {
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new LiveInspectorError('execCode timeout'));
        }, timeout);
      });

      try {
        ret = await Promise.race([evaluatePromise, timeoutPromise]);
      } catch (error) {
        err = error;
        debug('evaluate code failed:', error);
      }
    } else {
      ret = await evaluatePromise;
    }

    await post('Runtime.disable', null);

    if (err) {
      throw err;
    }

    return ret;
  };

  private stopInspecting = async () => {
    // 如果已经关闭，则不再处理
    if (!this.isWsAlive()) {
      return;
    }
    const post = promisify(this.post);
    await post('Runtime.enable', null);
    // 因为关闭inspect端口会导致通信断开，因此我们不等待返回结果
    await Promise.race([post(
      'Runtime.evaluate',
      Object.assign({}, kDefaultEvaluateOptions, {
        expression: 'require("inspector").close()'
      })
    ), new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1000)
    })]);
  };

  private resolveCallback = (ret: { id: number; error: any; result: any }) => {
    const callback = this.msgCallback.get(ret.id);

    if (!callback) {
      return;
    }

    this.msgCallback.delete(ret.id);
    callback(ret.error, ret.result);
  };

  /**
   * 获取到ws后，需要先校验进程pid是否一致
   * - 通过获取inspector协议获取pid
   *   - 如果pid一直，则表示成功，返回inspector通信wss
   *   - 否则表示失败
   */
  public connect = async (): Promise<IConnectRet | null> => {
    const { getBasicInfoTimeout } = this.options;

    if (this.usePid) {
      this.ws = await this.processInspectPort.connectByPid(
        this.options.pid as number
      );
    } else {
      this.ws = await this.processInspectPort.connectByAddr(this.addr as IAddr);
    }

    // 错误信息的结构: {"error":{"code":-32601,"message":"'Network.enable' wasn't found"},"id":1}
    // method对应返回结果: {"id":0,"result":{"debuggerId":"(F5BD333B71397448A957D1C1FD18B3E9)"}}
    // 事件对应结构: {"method":"Debugger.scriptParsed","params":{"scriptId":"70","url":"","startLine":0,"startColumn":0,"endLine":4,"endColumn":0,"executionContextId":1,"hash":"15dc6ea13d964cc14889cbc98a213cad303aa1e7","executionContextAuxData":{"isDefault":true},"isLiveEdit":false,"sourceMapURL":"","hasSourceURL":false,"isModule":false,"length":74}}
    this.ws.on('message', (data: string) => {
      debug('ws message', data);
      const ret = JSON.parse(data);

      if (typeof ret.id === 'number') {
        this.resolveCallback(ret);
        return;
      }

      if (ret.method) {
        this.event.emit(ret.method, ret.params);
        return;
      }
    });

    // 进程关闭时需要告知外部，并清理数据
    this.ws.once('close', (code: number, reason: string) => {
      debug('ws close');
      this.disconnect(false);
      this.event.emit(`${kDomain}.close`, {
        code,
        reason
      });
    });

    let ret: any = null;

    try {
      ret = await this.execCode(
        'Promise.resolve(JSON.stringify({ pid: process.pid, version: process.version }))',
        getBasicInfoTimeout
      );
    } catch (err) {
      debug('connect err', err)
    }

    if (ret === null) {
      return null;
    }

    if (!ret.result || ret.result.type !== 'string') {
      throw new LiveInspectorError('failed to communicate with the inspector');
    }

    const res = JSON.parse(ret.result.value);

    // 如果是通过指定pid进行的inspector通信，则需要校验pid是否一致
    if (this.usePid && res.pid !== this.options.pid) {
      throw new LiveInspectorError(
        `port 9229 has been occupied by pid: ${res.pid}`
      );
    }

    return res;
  };

  /**
   * 对于Node.js 8，同时只能有一个debugger接入ws，所以我们需要支持释放ws
   */
  public releaseWs = () => {
    if (!this.ws) {
      return;
    }
    this.ws.terminate();
    this.ws = null;
  };

  public disconnect = async (stopInspecting: boolean = this.usePid) => {
    if (stopInspecting) {
      await this.stopInspecting();
    }
    this.releaseWs();
  };
}
