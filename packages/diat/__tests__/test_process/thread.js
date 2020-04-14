/* eslint-disable */
const thread = require('worker_threads');
const path = require('path');

module.exports = async () => {
  setInterval(() => {}, 1000);
  for (let i = 0; i < 2; i += 1) {
    new thread.Worker(path.resolve(__dirname, './thread_worker.js'));
  }
};
