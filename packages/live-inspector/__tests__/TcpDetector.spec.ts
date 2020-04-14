import * as net from 'net';
import { TcpDetector } from '../src/TcpDetector';

describe('TcpDetector', () => {
  it('should work', async () => {
    const server = new net.Server(() => {});

    await new Promise(resolve => {
      server.listen(0, () => {
        resolve();
      });
    });

    const port = (server.address() as any).port;

    const tcpDetector = new TcpDetector(port);

    const succ = await new Promise(resolve => {
      tcpDetector.once('_check', succ => {
        resolve(succ);
      });
    });

    expect(succ).toBe(true);

    server.close();

    await new Promise(resolve => {
      tcpDetector.once('close', succ => {
        resolve(succ);
      });
    });
  });

  describe('detectPort', () => {
    it('should work', async () => {
      const server = new net.Server(() => {});

      await new Promise(resolve => {
        server.listen(0, () => {
          resolve();
        });
      });

      const port = (server.address() as any).port;

      expect(await TcpDetector.detectPort(port)).toBe(true);

      await new Promise(resolve => {
        server.close(() => {
          resolve();
        });
      });
      expect(await TcpDetector.detectPort(port)).toBe(false);
    });
  });
});
