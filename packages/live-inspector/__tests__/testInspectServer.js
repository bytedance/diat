/* eslint-disable */
const inspector = require('inspector');

inspector.open(0);

if (process.send) {
  process.send(inspector.url());
}

setInterval(() => {}, 1000);
