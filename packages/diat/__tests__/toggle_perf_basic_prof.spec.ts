import { Comm } from '../src/Comm';
import { createTestProcess, isNodeVersionLE8 } from './utils';
import { LinuxPerf } from '../src/LinuxPerf';

const kCmd = 'toggle_perf_basic_prof';

describe('toggle_perf_basic_prof', () => {
  const linuxPerf = new LinuxPerf();
  const modulePath = linuxPerf.getModulePath();

  if (!modulePath || isNodeVersionLE8()) {
    it('should skip', () => {});
    return;
  }

  let child: any;
  let comm: any;

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

  beforeEach(async () => {
    child = (await createTestProcess('net_socket_server')).child;
    comm = new Comm(child.pid, undefined);
    await comm.connect();
  });

  afterEach(async () => {
    await clear();
  });

  it('should work', async () => {
    expect(
      await comm.run(kCmd, {
        enable: false,
        modulePath
      })
    ).toEqual({
      type: 'success',
      content: expect.stringMatching(/false/)
    });

    expect(
      await comm.run(kCmd, {
        enable: true,
        modulePath
      })
    ).toEqual({
      type: 'success',
      content: expect.stringMatching(/true/)
    });

    expect(
      await comm.run(kCmd, {
        enable: true,
        modulePath
      })
    ).toEqual({
      type: 'success',
      content: expect.stringMatching(/false/)
    });

    expect(
      await comm.run(kCmd, {
        enable: false,
        modulePath
      })
    ).toEqual({
      type: 'success',
      content: expect.stringMatching(/true/)
    });
  });
});
