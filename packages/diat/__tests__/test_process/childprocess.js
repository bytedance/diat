const childProcess = require('child_process');
const path = require('path');

module.exports = async () => {
  const filepath = path.resolve(__dirname, './testIdleServer.js');
  const child = childProcess.fork(filepath, [], {
    env: {},
    execArgv: []
  });

  await new Promise(resolve => {
    child.on('message', resolve);
  });

  setTimeout(() => {
    child.kill();
  }, 100);

  return {
    stop: () => child.kill()
  };
};
