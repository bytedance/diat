import * as net from 'net';
import * as fs from 'fs';
import * as stream from 'stream';
import * as path from 'path';
import * as util from 'util';
import { Metric, kMessageSeperator } from '../src/Metric';

const kSocketPath = path.resolve(__dirname, './metric.sock');

describe('Metric', () => {
  beforeEach(async () => {
    try {
      await util.promisify(fs.unlink)(kSocketPath);
    } catch (err) {
      //
    }
  });

  it('should work', async () => {
    const passthrough = new stream.PassThrough();

    const metric = new Metric({
      std: passthrough,
      socketPath: kSocketPath
    });

    const socketPath = await metric.createServer();

    expect(socketPath).toEqual(kSocketPath);

    const socket = net.connect(socketPath);

    await new Promise(resolve => {
      socket.once('connect', () => {
        resolve();
      });
    });

    socket.write(
      JSON.stringify({
        cpuUsage: {
          user: 0,
          system: 0
        },
        memoryUsage: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0
        },
        uv: {
          request: 0,
          handle: 0,
          latency: 0
        }
      }) + kMessageSeperator
    );

    await new Promise(resolve => {
      let msg = '';
      passthrough.on('data', data => {
        msg += data.toString('utf8');
        if (msg.indexOf('[uv]') >= 0) {
          resolve();
        }
      });
    });

    socket.destroy();
    await metric.destroy();
  });
});
