# diat

[![npm](https://img.shields.io/npm/v/diat.svg)](https://www.npmjs.com/package/diat)
[![npm](https://img.shields.io/npm/l/diat.svg)](https://www.npmjs.com/package/diat)
![npm test](https://github.com/bytedance/diat/workflows/npm%20test/badge.svg)

[[中文文档]](./README.md)

diat is a CLI tool basing on [inspector](https://nodejs.org/api/inspector.html) (providing features: cpuprofile, heapsnapshot, debug...) to help with diagnosing Node.js processes:

- Out-of-the-box, and which help with those problems won't be reproduced stably. ([see limitation](<#Known\ Limitation>))
- Support inspecting threads created from `worker_threads`.
- Most commands work for blocked js threads because of basing on V8 inspector protocol.
- Having little extra resource usage when the process of diat exits.

## Links

- [Motivation](#Motivation)
- [Installation](#Installation)
- [Common Usage](<#Common\ Usage>)
  - [inspect](#inspect)
  - [inspectworker](#inspectworker)
  - [metric](#metric)
  - [cpuprofile](#cpuprofile)
  - [heapsnapshot](#heapsnapshot)
  - [perfbasicprof & perf2svg](#perfbasicprof--perf2svg)
- [Known Limitation](<#Known\ Limitation>)
- [How it works](<#How\ it\ works>)
- [Contributing](#Contributing)
- [License](#License)

## Motivation

When solving issues where using Node.js as backend servers, we find that **Node.js/V8 inspector is almost the most effective tool**. And many Node.js developers have experience in debugging with Chrome Devtools which makes it one of the lowest cost approach for troubing shooting.

However, there are still some problems haunt us:

- Some issues occur occasionally and are hard to reproduced. Restarting the Node.js process with inspector open cause the issue disappear.
- In some scenarios, we could open inspector but can't access it from outside network.
- Requesting every business lines to include some code for diagnostics in advance seems hard and relatively expensive.

Therefore, we expect diat to focus on this scenario, and could be a out-of-the-box tool to reduce the cost of utilizing Node.js/V8 inspector.

## Installation

```
npm i diat -g && diat --help
```

## Common Usage

You could test diat commands by starting a Node.js process like:

```
node -e "console.log(process.pid); setInterval(() => {}, 1000)"
```

### inspect

`inspect` will open the inspector of a process for later inspecting. Most problems could be solved if you could access the inspector.

```
diat inspect -p <PID>
```

which will return messages like below：

```
inspector service is listening on: 0.0.0.0:56324
or open the uri below on your Chrome to debug: devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=0.0.0.0:56324/408b7bca-1000-4c1f-a91e-de44d460e5ae
press ctrl/meta+c to exit
```

After seeing theses messages, you can use a debugger, e.g. Chrome Devtools, to connect the port of `56324`. Don't forget to replace the `0.0.0.0` into the public ip of your machine. You can also open the `devtools://xxx` in Chrome to connect with Chrome Devtools.

`inspect` opens inspector by sending SIGUSR1 signal the target process (see [document](https://nodejs.org/api/process.html#process_signal_events)). With concern of the security, Node.js process will listen to `127.0.0.1` so you can't access the inspector from the outside network. diat starts a tcp proxy to allow accessing from outside network. **That is, it's possible to be attacked by others. Make sure you have known this before using inspect.**

After inspecting, press `ctrl/meta+c` to make diat exit and diat will close inspector of the target process. If diat get killed, the target process listening to `127.0.0.1` so that inspector still won't be access from outside network.

### inspectworker

Currently, Node.js lacks debugging methods for worker_threads(see the [issue](https://github.com/nodejs/node/issues/26609), however, [ndb](https://github.com/GoogleChromeLabs/ndb) supports debugging). diat supports open inspectors for threads by `inspectworker` command:

```
diat inspectworker -p <PID>
```

It't possible to have more than one threads in a process so you need to choose the thread which you want to inspect:

```
? Choose a worker to inspect (Use arrow keys)
❯ Worker 2(id: 1) [file:///diat/packages/diat/
__tests__/test_process/thread_worker.js]
  Worker 1(id: 2) [file:///diat/packages/diat/
__tests__/test_process/thread_worker.js]
```

After selecting a thread, diat will open the inspector of the thread. You could utilize the inspector as how the [inspect](#inspect) part describes.

For now, we can't find a way to close the inspector from a thread. We will update the code when Node.js have official support of inspecting worker_threads.

### metric

`metric` will log the basic resource usage of a process:

```
diat metric -p <PID>
```

diat will log about the cpu, memeory and uv in every 2 seconds:

```
[cpu] load(user): 0.00032 load(system): 0.000068
[memory] rss: 29.78MB heapTotal: 4.18MB heapUsed: 2.33MB external: 873.74KB
[uv] handle: 3, request: 0, latency: 5ms
```

### cpuprofile

`cpuprofile` will create a .cpuprofile file including the functions get called during a period. CPU Profile helps to investigate high occupancy rate of CPU or performance analysis:

```
diat cpuprofile -p <PID>
```

diat will return the file path after the .cpuprofile generated:

```
profiling...
cpuprofile generated at: /diat_90504_1584018222518.cpuprofile
```

You could analyse the .cpuprofile by opening it on the Profiler panel of Chrome Devtools. See the [official document](https://developers.google.com/web/updates/2016/12/devtools-javascript-cpu-profile-migration) of Chrome Devtools.

`cpuprofile` support these options：

- `--duration` Sampling duration, default: 5000ms.
- `--interval` Sampling interval, default: 1000us. The shorter the interval is, the more accurate the .cpuprofile will be. Short interval also cost more extra resources.

The generated file pattern is: `./diat_$PID_$TS.cpuprofile`. You can specify the file name through `--file` option。

### heapsnapshot

`heapsnapshot` will create a .heapsnapshot file. Heap snapshot help us know the detail of memory heap which is helpful when investigating memory leaks.

```
diat heapsnapshot -p <PID>
```

You could analyse the .heapsnapshot by opening it on the Memory panel of Chrome Devtools. See the [official document](https://developers.google.com/web/tools/chrome-devtools/memory-problems/heap-snapshots#view_snapshots) of Chrome Devtools.

**Warn:** Generating heap snapshot might cause the process to exit. By default, the max-old-space-size of a Node.js process in 64bit machine is 1.4GB (this changed after Node.js 12.7.0) and taking heap snapshot needs extra memory. If the target process already has a large RSS, taking heap snapshot might cause the V8 to abort or cause the OOM killer to kill the target process.

The generated file pattern is: `./diat_$PID_$TS.heapsnapshot`. You can specify the file name through `--file` option。

### perfbasicprof & perf2svg

CPU Profile is helpful when investigating high occupacy of CPU in js. However, V8 CPU Profile can't sample functions from c/cpp/addon. For these situations, diat provides assistance to Linux perf for low level profiling (see [node.js Flame Graphs on Linux](http://www.brendangregg.com/blog/2014-09-17/node-flame-graphs-on-linux.html)).

Firstly, use `perfbasicprof` to make Node.js generate .map file which help perf to recognize js functions:

```
diat perfbasicprof -p <PID> -e true
```

Then use perf to profile:

```
perf record -F 1000 -p <PID> -g -m 512B -- sleep 5
```

perf will create a perf.data file if it succeeds. Use perf again to generate human readable contents:

```
perf script > out.nodestacks01
```

After the operation, use diat to make Node.js process stop generating .map file:

```
diat perfbasicprof -p <PID> -e false
```

Use `perf2svg` to generate a svg of the Flame graph:

```
diat perf2svg -f out.nodestacks01
```

## Known Limitation

### 1. Can't not pass PID on Windows

Because Windows doesn't support sending signals to processes. A workaround is to start your Node.js process with `--inspect` option to open inpsector directly. Then use `-a`/`--inspector_addr` option to pass inspector address instead of `-p`, for example:

```
node --inspect=9229 index.js
```

Then "open" the inspector with diat (in this senario, diat simply acts as a tcp proxy to allow outside network accessing):

```
diat inspect -a=127.0.0.1:9229
```

### 2. Can't open insecptor after port 9229 gets occupied

You can start a Node.js process with `--inspect=PORT` specifying an available port to open inspector. Then use `-a`/`--inspector_addr` option to pass inspector address instead of `-p`.

### 3. Limitations of inspector in Node.js 8

Inspector inside Node.js 8 (LTS End-of-life) has some limiations (which don't occur on Node.js >= 10):

1. Only one `inspector.Session` could connect at a time

Because of this limitation, diat can't work on a process of which inspector server has been connected by other clients. Some tools, like: `pm2` with `--max-memory-restart` option, will also connect to the inspector server so that you can't use diat in these scenarios.

## How it works

### Fundamentals

1. Use `SIGUSR1` signal to open inspector on 9229: https://nodejs.org/api/process.html#process_signal_events
2. Use v8-inspector(node) protocol to communicate with inspectors. We can utilize many inspector features including run a code snippet: https://chromedevtools.github.io/devtools-protocol/v8/HeapProfiler/

### How inspectworker works

Node.js has some internal protocols other than v8-inspector(node) for trace and worker_threads moduels. See them at: https://github.com/nodejs/node/blob/master/src/inspector/node_protocol.pdl

These protocols allow communicate with inspectors inside of threads.

## Contributing

This project relies on "lerna". Initialize the project after `git clone`:

```
cd diat && npm install
```

`linux-perf`, `node-inspect` and `stackvis-simplified` are repos modified from the community. Mose code of diat are included in:

- packages/diat: Includes the code of CLI
- packages/live-inspector: Communicating with inspectors

Make sure all tests have pass before creating a PR. Please describe your modification in the commit message. Run tests with `npm run test`.

Known issue: There seems to be some issues when using jest with worker_threads which cause the jest process won't exit automatically.

## License

[MIT](./LICENSE)
