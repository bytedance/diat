const childProcess = require('child_process')

const kCiTestTimeout = 50 * 1000

async function main() {
  const child = childProcess.exec('npm run test')

  child.stdout.on('data', (data) => {
    process.stdout.write(data)
  })
  child.stderr.on('data', (data) => {
    process.stderr.write(data)
  })

  child.on('exit', () => {
    process.exit()
  })

  setTimeout(() => {
    child.kill()
    process.exit()
  }, kCiTestTimeout)
}

main()
