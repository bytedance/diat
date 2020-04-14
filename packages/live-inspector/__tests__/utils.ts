import * as childProcess from 'child_process';
import * as path from 'path';

const kIdleFilePath = path.resolve(__dirname, './testIdleServer.js');
const kInspectFilePath = path.resolve(__dirname, './testInspectServer.js');

export function createTestProcess() {
  return new Promise<childProcess.ChildProcess>(resolve => {
    const child = childProcess.fork(kIdleFilePath);

    child.once('message', () => {
      resolve(child);
    });
  });
}

export function createInspectProcess() {
  return new Promise<{ child: childProcess.ChildProcess; addr: string }>(
    (resolve, reject) => {
      const child = childProcess.fork(kInspectFilePath);
      // 获取inspecto端口
      child.once('message', data => {
        const ret = /ws\:\/\/(.+\:\d+)\//.exec(String(data));

        if (!ret) {
          reject(new Error('failed to spwan the process'));
          return;
        }

        resolve({
          child,
          addr: ret[1]
        });
      });
    }
  );
}
