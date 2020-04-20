import * as semver from 'semver'
import * as os from 'os'

export class LinuxPerf {
  constructor() {}

  getModulePath(): null | string {
    if (
      os.platform() === 'win32' ||
      !semver.satisfies(process.version, '>=10.4.0')
    ) {
      /* istanbul ignore next */
      return null
    }

    try {
      return require.resolve('diat-linux-perf')
    } catch (err) {
      //
    }
    /* istanbul ignore next */
    return null
  }
}
