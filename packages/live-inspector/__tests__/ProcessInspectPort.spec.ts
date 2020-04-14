import { killPid, ProcessInspectPort } from '../src/ProcessInspectPort';
import { createTestProcess, createInspectProcess } from './utils';

// 通常应该没有这么大的pid
const kInvalidPid = 10000000;

describe('ProcessInspectPort', () => {
  describe('killPid', () => {
    it("should reject the promise if the process doesn't exist", async () => {
      expect(() => killPid(kInvalidPid, 'SIGUSR1')).toThrow();
    });

    it('should work', async () => {
      const child = await createTestProcess();

      expect(child.pid).toBeTruthy();

      const childKilled = new Promise(resolve => {
        child.on('exit', () => {
          resolve();
        });
      });

      await killPid(child.pid, 'SIGKILL');
      await childKilled;
    });
  });

  describe('ProcessInspectPort', () => {
    it('should throw if failed to connect', async () => {
      const pro = new ProcessInspectPort({});

      await expect(pro.connectByPid(kInvalidPid)).rejects.toThrow();
    });

    // TODO 这个测试需要本地9229端口没有被占用
    it(
      'should connect to the inspector server',
      async () => {
        const child = await createTestProcess();
        const pro = new ProcessInspectPort({
          retryTimes: 10
        });

        const ws = await pro.connectByPid(child.pid);
        expect(ws).toBeTruthy();
        child.kill('SIGKILL');
        ws.terminate();
      },
      30 * 1000
    );

    it('should support connect by inspect url', async () => {
      const { child, addr: addrStr } = await createInspectProcess();
      const pro = new ProcessInspectPort({
        retryTimes: 10
      });

      const arr = addrStr.split(':');

      const addr = {
        host: arr[0],
        port: parseInt(arr[1], 10)
      };

      const ws = await pro.connectByAddr(addr);
      expect(ws).toBeTruthy();

      child.kill('SIGKILL');
      ws.terminate();
    });
  });
});
