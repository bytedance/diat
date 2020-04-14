import * as inspector from 'inspector';
import * as util from 'util';
import * as path from 'path';
import { InspectorWorker } from '../src/InspectorWorker';
import { hasWorker, kTimeout } from './utils';

describe('InspectorWorker', () => {
  const workers: any[] = [];
  let session: inspector.Session;
  let post: any;
  let inspectorWorker: InspectorWorker;

  if (!hasWorker()) {
    it('(skipped)', () => {});
    return;
  }
  const thread = require('worker_threads');

  beforeAll(async () => {
    for (let i = 0; i < 2; i += 1) {
      workers.push(
        new thread.Worker(
          path.resolve(__dirname, './test_process/thread_worker.js')
        )
      );
    }
  });

  afterAll(async () => {
    // NOTE Workers won't exit so we add '--forceExit' to jest.
    for (const worker of workers) {
      worker.terminate()
    }
  });

  beforeEach(async () => {
    session = new inspector.Session();
    session.connect();
    post = util.promisify(session.post.bind(session));
    inspectorWorker = new InspectorWorker({
      post,
      event: ({
        removeListener: (name, cb) => {
          return session.removeListener(name, cb)
        },
        addListener: (name, cb) => {
          return session.addListener(name, (msg) => {
            cb(msg.params)
          })
        }
      } as any)
    });
  });

  afterEach(async () => {
    await inspectorWorker.destroy();
    await post('NodeWorker.disable');
    session.disconnect();
  });

  it('should work', async () => {
    const infos: any = await inspectorWorker.getWorkers();
    expect(infos).toEqual([expect.anything(), expect.anything()]);
    const ret = await inspectorWorker.createWorkerSession(
      infos[0].sessionId
    );
    expect(ret).toEqual({
      host: expect.anything(),
      port: expect.anything(),
      address: expect.anything(),
      family: expect.anything(),
    });
  }, kTimeout);
});
