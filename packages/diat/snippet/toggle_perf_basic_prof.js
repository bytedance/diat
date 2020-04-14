(async options => {
  if (typeof options !== 'object') {
    throw new Error('invalid options');
  }

  const { enable, modulePath } = options;
  const linuxPerf = require(modulePath);
  return JSON.stringify({
    operationReturn: enable ? linuxPerf.start() : linuxPerf.stop(),
    pid: process.pid
  });
})(__OPTIONS__);
