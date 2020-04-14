const dgram = require('dgram');

module.exports = async () => {
  const socket = dgram.createSocket('udp4');

  await new Promise(resolve => {
    socket.bind(0, resolve);
  });

  return {};
};
