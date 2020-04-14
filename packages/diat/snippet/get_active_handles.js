(async () => {
  const net = require('net');
  const dgram = require('dgram');
  const tty = require('tty');
  const childProcess = require('child_process');
  // const stream = require('stream');

  // const kFsWriteStream = 'fs.WriteStream';
  // const kFsReadStream = 'fs.ReadStream';
  const kChildProcessChildProcess = 'child_process.ChildProcess';
  const kTtyReadStream = 'tty.ReadStream';
  const kTtyWriteStream = 'tty.WriteStream';
  const kNetServer = 'net.Server';
  const kNetSocket = 'net.Socket';
  const kDgramSocket = 'dgram.Socket';
  const kTimers = 'timers';

  // TODO try to get the fd so that we could collaborate with lsof
  // NOTE(oyyd) The order of kHandleInfos matters as some instances might
  // be instanceof more than one class.
  const kHandleInfos = [
    // TODO fs streams are not included in the active handles
    // {
    //   key: kFsWriteStream,
    //   checkClazz: async instance => {
    //     return (
    //       instance instanceof stream.Writable &&
    //       ['path', 'fd', 'flags', 'mode'].every(i => instance.hasOwnProperty(i))
    //     );
    //   }
    // },
    // {
    //   key: kFsReadStream,
    //   checkClazz: async () => {
    //     //
    //   }
    // },
    {
      key: kTtyReadStream,
      clazz: tty.ReadStream
    },
    {
      // TODO some tty.WriteStream might be regared as net.Socket
      key: kTtyWriteStream,
      clazz: tty.WriteStream
    },
    {
      key: kNetServer,
      clazz: net.Server,
      getInfo: async server => {
        const address = server.address();

        const connections = await new Promise(resolve => {
          server.getConnections((err, count) => {
            resolve(err ? 0 : count);
          });
        });

        return {
          address,
          connections
        };
      }
    },
    {
      key: kNetSocket,
      clazz: net.Socket,
      getInfo: async socket => {
        const { localAddress, localPort, remoteAddress, remotePort } = socket;

        return {
          localAddress,
          localPort,
          remoteAddress,
          remotePort
        };
      }
    },
    {
      key: kDgramSocket,
      clazz: dgram.Socket,
      getInfo: async socket => {
        const address = socket.address();
        return {
          address
        };
      }
    },
    {
      key: kChildProcessChildProcess,
      clazz: childProcess.ChildProcess,
      getInfo: async child => {
        return {
          pid: child.pid
        };
      }
    },
    {
      key: kTimers,
      checkClazz: async instance => {
        const name = instance.constructor.name;
        return name === 'Timeout' || name === 'Timer' || name === 'Immediate';
      }
    }
  ];
  const statistic = {};
  const extraInfos = {};

  kHandleInfos.forEach(info => {
    const { key, getInfo } = info;
    statistic[key] = 0;

    if (typeof getInfo === 'function') {
      extraInfos[key] = [];
    }
  });

  const handles = process._getActiveHandles();

  for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
    const handle = handles[handleIndex];

    for (let i = 0; i < kHandleInfos.length; i += 1) {
      const info = kHandleInfos[i];
      const { key, clazz, checkClazz, getInfo } = info;

      const check = checkClazz
        ? checkClazz
        : instance => Promise.resolve(instance instanceof clazz);

      if (await check(handle)) {
        statistic[key]++;
        if (typeof getInfo === 'function') {
          const ret = await getInfo(handle);
          extraInfos[key].push(ret);
        }
        break;
      }
    }
  }

  const ret = {
    handleLength: handles.length,
    statistic,
    extraInfos
  };

  return JSON.stringify(ret);
})();
