import * as semver from 'semver'

export class LinuxPerf {
  constructor() {}

  getModulePath(): null | string {
    if (!semver.satisfies(process.version, '>=10.4.0')) {
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
