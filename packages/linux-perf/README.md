# node-linux-perf

Library to replace V8's `--perf-basic-prof` flag, with the ability to toggle
creation of Linux `perf` map files during runtime.

It's recommended to run Node.js with the `--interpreted-frames-native-stack`
flag enabled, otherwise Linux perf will not be able to translate the name of
many JavaScript functions.

## Build Status

| Version               | Status                                     |
|-----------------------|--------------------------------------------|
| Node.js v10.x         | [![v10.x badge][v10-badge]][travis]        |
| Node.js v12.x         | [![v12.x badge][v12-badge]][travis]        |
| nodejs/node@master    | [![master badge][master-badge]][travis]    |
| nodejs/node-v8@canary | [![v8-canary badge][canary-badge]][travis] |

[travis]: https://travis-ci.com/mmarchini/node-linux-perf
[master]: https://github.com/nodejs/node/tree/master
[canary]: https://github.com/nodejs/node-v8/tree/canary
[v10-badge]: https://travisci-matrix-badges.herokuapp.com/repos/mmarchini/node-linux-perf/branches/master/1?use_travis_com=true
[v12-badge]: https://travisci-matrix-badges.herokuapp.com/repos/mmarchini/node-linux-perf/branches/master/2?use_travis_com=true
[master-badge]: https://travisci-matrix-badges.herokuapp.com/repos/mmarchini/node-linux-perf/branches/master/3?use_travis_com=true
[canary-badge]: https://travisci-matrix-badges.herokuapp.com/repos/mmarchini/node-linux-perf/branches/master/4?use_travis_com=true

## Installation

```bash
$ npm install linux-perf
```

## Usage

```javascript
const linuxPerf = require('linux-perf');

// Generated a /tmp/perf-PID.map file and updates it when necessary
linuxPerf.start();

// **YOUR CODE HERE**

// Stops writing to /tmp/perf-PID.map
linuxPerf.stop();
```

## API

### `start(): bool`

Generates a `/tmp/perf-PID.map` file and updates it when necessary (for example,
when new functions are declared). If a `/tmp/perf-PID.map` file already exists,
its content will be erased, and a new file will be generated.

**Return**: `true` if the file was generated successfully, `false` otherwise.

### `stop(): bool`

Stops writing to `/tmp/perf-PID.map`. The content written on the file is
preserved.

**Return**: `true` if it was able to stop writting to the file, `false`
  otherwise.
