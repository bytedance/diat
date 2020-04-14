/* eslint-disable */
setInterval(() => {}, 1000);

if (process.send) {
  if (process.argv[2]) {
    const func = require(process.argv[2]);
    func().then(obj => {
      process.send('hello');
    });
  } else {
    process.send('hello');
  }
} else {
  console.log(process.pid);
}
