(async options => {
  const { socketPath, interval = 2000, messageSeperator = '__$' } = options;
  // connect
  const net = require('net');

  const socket = await new Promise(resolve => {
    const socket = net.connect(socketPath, () => {
      resolve(socket);
    });
  });

  let timer = null;
  let lastCpuUsage = null;
  let uvStartTime = null;

  const destroy = () => {
    clearInterval(timer);
  };

  const collect = () => {
    // cpu
    const cpuUsage = process.cpuUsage();
    let cpuUsageUser = 0;
    let cpuUsageSystem = 0;
    let uvLatency = 0;

    if (lastCpuUsage) {
      cpuUsageUser = (cpuUsage.user - lastCpuUsage.user) / (interval * 1e3);
      cpuUsageSystem =
        (cpuUsage.system - lastCpuUsage.system) / (interval * 1e3);
    }

    lastCpuUsage = process.cpuUsage();

    const now = Date.now();

    // latency
    if (uvStartTime) {
      uvLatency = Math.max(now - uvStartTime - interval, 0);
    }

    uvStartTime = now;

    const ret = {
      cpuUsage: {
        user: cpuUsageUser,
        system: cpuUsageSystem
      },
      memoryUsage: process.memoryUsage(),
      uv: {
        latency: uvLatency,
        handle: process._getActiveHandles().length,
        request: process._getActiveRequests().length
      }
    };

    socket.write(JSON.stringify(ret) + messageSeperator);
  };

  socket.on('error', () => {
    //
  });

  socket.once('close', destroy);

  lastCpuUsage = process.cpuUsage();
  uvStartTime = Date.now();
  timer = setInterval(collect, interval);
})(__OPTIONS__);
