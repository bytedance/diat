# live-inspector

开启一个Node.js进程的inspect端口，并与其通信。

## 原理

SIGUSR1 + inspector protocol

## 限制

- 因为`SIGUSR1`没法用在windows上，所以这个lib不支持windows。
- 因为只能监听9229端口，所以如果9229端口已经被占用（比如被其他Node.js的inspect端口占用），则无法正确进行操作。
- 如果进程已经开启了inspector端口并进行了一些操作，同时使用这个lib可能会产生未知后果。

## 使用

```js
const { Communication } = require('diat-live-inspector')

(async () => {
  const comm = new Communication({
    pid: PID
  })

  // 开始通信
  await comm.connect()

  // 执行一个表达式
  const ret = await comm.execCode('process.version')

  console.log(ret) // 输出: { result: { type: 'string', value: 'v10.16.0' } }

  // 关闭通信
  await comm.disconnect()
})();
```

## API

TODO

## 事件

通过`Communication.event`是`Events`实例，可以通过其监听到inspector协议中的事件。除了inspector协议的事件外，还包括`Communication`自定义的事件，有：

- `LiveInspector.close`: ws关闭。参数表示关闭的原因，包含: code, reason
