module.exports = async () => {
  const net = require('net');

  const server = net.createServer(() => {});

  await new Promise(resolve => {
    server.listen(resolve);
  });

  await new Promise(resolve => {
    const client = net.connect(server.address().port, resolve);
  });

  return {};
};
