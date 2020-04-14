import { Comm } from '../src/Comm';
import { createTestProcess, kTimeout } from './utils';

describe('get_active_handles', () => {
  let child: any;
  let comm: Comm | null;

  const clear = async () => {
    if (comm) {
      await comm.disconnect();
      comm = null;
    }

    if (child) {
      child.kill();
      child = null;
    }
  };

  afterEach(async () => {
    await clear();
  });

  it(
    'should work with net.Socket and net.Server',
    async () => {
      child = (await createTestProcess('net_socket_server')).child;
      comm = new Comm(child.pid, undefined);
      await comm.connect();

      const ret = await comm.run('get_active_handles');
      const result = JSON.parse(ret.content);
      expect(result.statistic['net.Server']).toBe(1);
      expect(result.statistic['net.Socket']).toBeGreaterThan(0);
      expect(result.extraInfos['net.Server']).toEqual([
        {
          address: expect.anything(),
          connections: 1
        }
      ]);
      const socketInfo = result.extraInfos['net.Socket'];
      expect(socketInfo[socketInfo.length - 1]).toEqual({
        localAddress: expect.anything(),
        localPort: expect.anything(),
        remoteAddress: expect.anything(),
        remotePort: expect.anything()
      });
    },
    kTimeout
  );

  it(
    'should work with dgram.Socket',
    async () => {
      child = (await createTestProcess('udp_socket')).child;
      comm = new Comm(child.pid, undefined);
      await comm.connect();

      const ret = await comm.run('get_active_handles');
      expect(ret.type).toBe('success');
      const result = JSON.parse(ret.content);
      expect(result.statistic['dgram.Socket']).toBe(1);
      const socketInfo = result.extraInfos['dgram.Socket'];
      expect(socketInfo).toEqual([
        {
          address: {
            address: expect.anything(),
            family: expect.anything(),
            port: expect.anything()
          }
        }
      ]);
    },
    kTimeout
  );

  // TODO(oyyd): This test will stop the process from exiting.
  it('should work with child_process', async () => {
    const key = 'child_process.ChildProcess';
    child = (await createTestProcess('childprocess')).child;
    comm = new Comm(child.pid, undefined);
    await comm.connect();

    const ret = await comm.run('get_active_handles');
    expect(ret.type).toBe('success');
    const result = JSON.parse(ret.content);
    expect(result.statistic[key]).toBe(1);

    expect(result.extraInfos[key]).toEqual([
      {
        pid: expect.anything()
      }
    ]);
  });
});
