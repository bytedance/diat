import * as net from 'net';
import * as events from 'events';

const kInterval = 1000;

interface IOptions {
  noTimer: boolean;
}

export class TcpDetector extends events.EventEmitter {
  private port: number;
  private options: IOptions;
  private timer: any = null;

  static detectPort = async (port: number): Promise<boolean> => {
    const detector = new TcpDetector(port);

    const res = await detector.connect();

    detector.destroy();

    return res;
  };

  constructor(port: number, options: IOptions = { noTimer: false }) {
    super();

    this.options = options;

    if (!port) {
      throw new Error(`invalid port: ${port}`);
    }

    this.port = port;

    if (!this.options.noTimer) {
      this.timer = setInterval(() => {
        this.connect().then(success => {
          this.emit('_check', success);
          if (!success) {
            this.destroy();
          }
        });
      }, kInterval);
    }
  }

  private connect = (): Promise<boolean> => {
    const { port } = this;

    return new Promise(resolve => {
      const socket = net.connect(port);

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  };

  destroy = () => {
    clearInterval(this.timer);
    this.emit('close');
  };
}
