# diat

[![npm](https://img.shields.io/npm/v/diat.svg)](https://www.npmjs.com/package/diat)
[![npm](https://img.shields.io/npm/l/diat.svg)](https://www.npmjs.com/package/diat)

[[English Doc]](./README_EN.md)

diat 是基于[inspector](https://nodejs.org/api/inspector.html)模块（提供: cpuprofile, heapsnapshot, debug 等能力）用于协助 Node.js 进程进行问题诊断的 CLI 工具。其特点在于：

- 开箱即用，无需应用事先接入。因为不需要重启进程，所以对偶发的问题会有所帮助。但在部分环境下会有[相应的限制](#已知限制)。
- 支持对 worker_threads 开启的线程进行 inspect。
- 因为基于 inspector 协议，并且 Node.js 的 inspector server 是运行在独立的线程上，所以大部分功能在进程的主线程阻塞时也可以工作。
- 需要消耗额外资源的命令在工具退出后会关闭，尽可能少给进程带来额外的资源消耗。

## 索引

- [动机](#动机)
- [安装](#安装)
- [使用场景介绍](#使用场景介绍)
  - [inspect](#inspect)
  - [inspectworker](#inspectworker)
  - [metric](#metric)
  - [cpuprofile](#cpuprofile)
  - [heapsnapshot](#heapsnapshot)
  - [perfbasicprof & perf2svg](#perfbasicprof & perf2svg)
- [已知限制](#已知限制)
- [工作原理](#工作原理)
- [Contributing](#Contributing)
- [License](#License)

## 动机

在解决 Node.js 服务端应用中发生的问题的过程中，我们发现**Node.js/V8 原生的 inspector 模块是解决各类问题最有效的工具**（不考虑大量使用 addon，因而需要排查 c/cpp 代码的情况），比如：用 cpuprofile 解决 cpu 使用率异常的问题；用 heapsnapshot 排查内存泄漏的问题等等。并且不少 Node.js 开发者具有 web 开发的经验，也就是说开发者学习利用 Chrome Devtools 进行问题排查可能是成本的最低途径之一。

虽然 inspector 如此强大，但在实际的实践过程中仍然有一些问题困扰着我们，比如：

- 有些线上问题偶发且难以追踪、复现，开启 inspector 重启应用后问题消失
- 有些环境我们可以开启 inspector，但外网无法访问
- 非业务性质的线上问题诊断本身是一个重要但低频的场景，相比之下要求各个业务线事先统一接入一套诊断工具的成本较高（但问题还是会找到你）

因此我们期望 diat 针对线上问题诊断的场景，能作为一个开箱即用的工具，围绕 Node.js/V8 inspector 的能力缩短 V8 inspector 的使用成本。

## 安装

```
npm i diat -g && diat --help
```

## 使用场景介绍

你可以用下面的命令开启一个 Node.js 进程用于测试:

```
node -e "console.log(process.pid); setInterval(() => {}, 1000)"
```

### inspect

`inspect`命令用来打开一个进程的 inspector 用于直接调试。通常如果你能打开 inspector 并访问到，大部分问题都可以通过 inspector 协议上的功能解决。

```
diat inspect -p <PID>
```

成功后会返回如下信息：

```
inspector service is listening on: 0.0.0.0:56324
or open the uri below on your Chrome to debug: devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=10.90.39.11:56324/408b7bca-1000-4c1f-a91e-de44d460e5ae
press ctrl/meta+c to exit
```

当看到这样的信息后，你可以用调试工具接入`56324`端口，注意`0.0.0.0`需要换成可访问到的公网 ip。你也可以直接用 Chrome 打开后面的`devtools://`url 用 Chrome devtools 连接进程的 inspector。

`inspect`命令是通过发送 SIGUSR1 信号让 Node.js 内置的代码开启 inspector 端口，详情见[文档](https://nodejs.org/api/process.html#process_signal_events)。但出于安全考虑 Node.js 是让 inspector 监听`127.0.0.1`ip 地址，也就是外网无法访问。diat 在这基础之上做了个 tcp 代理让外网可以访问到进程 inspector，**也就是存在被恶意访问 inspector 的风险。因此需要仔细斟酌你的使用场景是否适用**。

排查结束用`ctrl/meta+c`退出 diat 进程后，diat 会关闭业务进程中的 inspector。如果 diat 进程异常退出没能关闭进程的 inspector 的话，因为 inspector 默认监听的是`127.0.0.1`端口，一般风险也不大。

### inspectworker

目前社区缺少对 worker_threads 开启的线程进行调试的支持（[ndb](https://github.com/GoogleChromeLabs/ndb)支持）。`inspectworker`命令可以用来打开线程的 inspector 进行调试：

```
diat inspectworker -p <PID>
```

进程可以通过 worker_threads 打开多个线程，所以接入成功后首先要选择我们想要 inspect 的线程：

```
? Choose a worker to inspect (Use arrow keys)
❯ Worker 2(id: 1) [file:///diat/packages/diat/
__tests__/test_process/thread_worker.js]
  Worker 1(id: 2) [file:///diat/packages/diat/
__tests__/test_process/thread_worker.js]
```

选择相应的线程后，diat 会打开对应线程的 inspector，后续使用方式同`inspect`命令，可以参照[inspect](#inspect)中的描述。

因为目前 Node.js 对 worker_threads 中的 inspector 的支持有所缺失（或者说未来 worker_threads 的调试方式不一定是以 inspector 为主），所以目前 diat 打开线程中的 inspector 后无法关闭。

### metric

`metric`命令用于查看进程占用的资源：

```
diat metric -p <PID>
```

开启后会展示 cpu、memory 和 uv 相关的一些基础数据：

```
[cpu] load(user): 0.00032 load(system): 0.000068
[memory] rss: 29.78MB heapTotal: 4.18MB heapUsed: 2.33MB external: 873.74KB
[uv] handle: 3, request: 0, latency: 5ms
```

数据每隔 2s 进行一次更新。

### cpuprofile

`cpuprofile`命令用于让进程进行 cpu prfile，从而生成.cpuprofile 文件记录一段时间内 js 中的函数执行情况。cpu profile 可以帮助我们排查 cpu 使用率过高的问题，或是用于协助进行性能分析：

```
diat cpuprofile -p <PID>
```

当.cpuprofile 文件生成成功后，diat 会返回文件所在的位置：

```
profiling...
cpuprofile generated at: /diat_90504_1584018222518.cpuprofile
```

你可以在 Chrome Devtools 中的 Profiler 面板中打开.cpuprofile 文件进行分析。关于 cpu profile 的使用说明可以参考 Chrome Devtools 的[官方文档](https://developers.google.com/web/updates/2016/12/devtools-javascript-cpu-profile-migration)。

cpuprofile 支持配置如下参数：

- `--duration` 表示采样的时间，默认为 5000ms。
- `--interval` 表示采样间隔，默认为 1000us。采样间隔越小，则 cpuprofile 越准确，但需要进程额外消耗的资源越多。

cpuprofile 默认的文件格式是：`./diat_$PID_$TS.cpuprofile`，可通过`--file`改变指定生成文件的名称。

### heapsnapshot

`heapsnapshot`命令用于生成.heapsnapshot 文件（堆快照）。heap snapshot 可以让我们了解进程中的内存占用细节，可以用来帮助我们排查内存泄漏问题：

```
diat heapsnapshot -p <PID>
```

你可以在 Chrome Devtools 中的 Memory 面板中打开.heapsnapshot 文件进行分析。关于 heap snapshot 的使用说明可以参考 Chrome Devtools 的[官方文档](https://developers.google.com/web/tools/chrome-devtools/memory-problems/heap-snapshots#view_snapshots)。

**注意：** 生成 heap snapshot 可能导致内存占用比较高的进程退出。因为没有指定参数的话，Node.js 进程在 64bit 机器上的 max-old-space-size 是 1.4GB 左右（Node.js 12 上的某个版本开始不再做这个默认的限制），而 heap snapshot 在生成的过程中会额外占用不少内存。此时继续增大内存占用会导致 V8 abort 或系统 OOM killer 关闭业务进程。对于这个问题暂时可能没有什么好的办法处理。

heapsnapshot 文件的默认格式是：`./diat_$PID_$TS.heapsnapshot`，可通过`--file`改变指定生成文件的名称。

### perfbasicprof & perf2svg

cpu profile 对于排查 js 中与 cpu 相关的问题很有帮助。但是因为 cpu profile 是 V8 记录的 js 中的函数执行情况，所以对于 Node.js 底层代码中或 addon 代码中的函数调用情况，我们没办法通过 cpu profile 进行排查。如果发生这类问题我们需要 c/cpp 的 profile 进行排查。diat 对 Linux perf 方案提供额外的支持（可以参考[node.js Flame Graphs on Linux](http://www.brendangregg.com/blog/2014-09-17/node-flame-graphs-on-linux.html)）。

首先通过`perfbasicprof`让 Node.js 进程生成.map 文件，.map 文件让 perf 能识别 js 的函数：

```
diat perfbasicprof -p <PID> -e true
```

接着让 perf 对进程进行 profile：

```
perf record -F 1000 -p <PID> -g -m 512B -- sleep 5
```

成功后我们会在当前文件下找到 perf.data 文件，文件中描述了这段时间内进程中的函数调用。用 perf 再次处理以获取可以直接读取的内容：

```
perf script > out.nodestacks01
```

操作结束后让 Node.js 停止生成.map 文件，减少资源消耗：

```
diat perfbasicprof -p <PID> -e false
```

如果我们想生成 Flame graph，可以`perf2svg`用做进一步处理生成 svg：

```
diat perf2svg -f out.nodestacks01
```

## 已知限制

### 1. 无法在 Windows 上直接传入 PID

因为 Windows 不支持给进程发送信号打开 inspector，所以也就没办法用`-p`选项传入 pid。可以考虑在启动 Node.js 时增加`--inspect`打开 inspector 并在 diat 的命令中用`-a`/`--inspector_addr`配置替代`-p`配置传入 inspector 的地址，比如：

```
node --inspect=9229 index.js
```

然后用 diat“打开”inspector（实际上做的事情只是在公共 ip 代理 inspector 服务）：

```
diat inspect -a=127.0.0.1:9229
```

### 2. 9229 端口被占用后，无法通过 SIGUSR1 信号在默认的 9229 端口上打开 inspector

同样可以考虑在启动 Node.js 时增加`--inspect=PORT`指定一个可用的端口打开 inspector，并在 diat 的命令中用`-a`/`--inspector_addr`配置替代`-p`配置传入 inspector 的地址。

### 3. Node.js 8 版本中 inspector 的限制

Node.js 8 版本（目前已经退出 LTS）中的 inspector 有一些限制（这些问题不存在于 Node.js >= 10 的版本中），比如：

1. 同一时间只能有一个`inspector.Session`接入

因为这个限制的存在，也就意味着如果已经打开并接入了进程的 inspector 端口，比如：用 Chrome Devtools 接入。那后续接入 inspector 的尝试都会失败，diat 也就没办法生效。而有些工具，比如`pm2`中的某些配置，比如：`--max-memory-restart`，也会打开进程的 inspector 并接入，所以这种情况下新的接入也会失败。

## 工作原理

### 基本工作原理

1. 用 SIGUSR1 信号在 9229 端口上打开 inspector: https://nodejs.org/api/process.html#process_signal_events
2. 利用 v8-inspector(node) 协议进行通信，可以执行对应的 inspector 功能，包括执行一段指定的代码: https://chromedevtools.github.io/devtools-protocol/v8/HeapProfiler/

### inspectworker 的工作原理

除了 v8-inspector(node) 的协议外，Node.js 内部还有定义一些协议用于 trace 和 worker_threads 等功能，定义见：https://github.com/nodejs/node/blob/master/src/inspector/node_protocol.pdl

这些协议中包括和线程中的 inspector 进行通信的部分。diat 通过该协议让线程打开 inspector，从而允许外部接入。

## Contributing

项目使用 lerna 进行管理，`git clone` 项目后进行安装：

```
cd diat && npm install
```

packages 文件夹下的 linux-perf、node-inspect 和 stackvis-simplified 是对社区里面的项目进行了些改造的代码。diat 自身的代码主要在：

- packages/diat：CLI 命令行工具的主要代码
- packages/live-inspector：处理与 inspector 通信

提交代码前需要确保测试通过，并在 commit message 中描述对应的改动。测试可通过`npm run test`执行。

已知问题：目前因为 jest 在检测 worker_threads 开启的线程上似乎有些问题，导致测试无法自动退出。

## License

[MIT](./LICENSE)
