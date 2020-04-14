module.exports = async () => {
  const inspector = require('inspector')

  setInterval(() => {

  }, 1000)

  inspector.open(0)
  const url = inspector.url()
  const ret = /ws\:\/\/(.+)\:(\d+)/.exec(url)

  if (!ret) {
    process.exit(1)
  }

  process.send({
    host: ret[1],
    port: Number(ret[2])
  })
}
