const semver = require('semver')
const childProcess = require('child_process')
const os = require('os')
const packageJSON = require('./package.json')

const kGypRebuildCmd = 'node-gyp rebuild'

function isEAccesMsg(msg) {
  return /EACCES/.test(msg)
}

async function main() {
  if (os.platform() === 'win32') {
    console.warn(`win32 doesn't support ${packageJSON.name}`)
  } else if (semver.satisfies(process.version, '>=10.4.0')) {
    const child = childProcess.exec(kGypRebuildCmd)
    let stderrStrs = ''
    child.stdout.on('data', (data) => {
      process.stdout.write(data)
    })
    child.stderr.on('data', (data) => {
      stderrStrs += data
    })
    child.on('exit', (code) => {
      if (code === 0) {
        return
      }

      const msg = stderrStrs
      if (isEAccesMsg(msg)) {
        console.warn(`failed to install ${packageJSON.name} because of EACCES, you can add "npm_config_user=$USER" and reinstall`)
        return
      }

      process.stderr.write(msg)
      process.exit(1)
    })
  } else {
    console.warn(`current version of Node.js is ${process.version} which doesn't support ${packageJSON.name}`)
  }
}

main()
