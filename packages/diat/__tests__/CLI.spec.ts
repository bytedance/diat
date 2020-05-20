jest.mock('../src/LinuxPerf')

import { CLI } from '../src/CLI'

describe('CLI', () => {
  describe('CLI#getYargsOptions', () => {
    it('should return options', () => {
      const cli = new CLI({})
      const options = cli.getYargsOptions()
      expect(options.length).toBeGreaterThan(0)
      const inspectOpt = options.find((i) => i.command === 'inspect')
      expect(inspectOpt).toBeTruthy()
    })
  })

  describe('#togglePerfBasicProf_', () => {
    const linuxPerfMod = require('../src/LinuxPerf')
    let getModulePathRet = null

    it('should throw if not found', async () => {
      linuxPerfMod.LinuxPerf.mockImplementation(
        jest.fn(() => ({
          getModulePath: () => getModulePathRet,
        }))
      )

      const { togglePerfBasicProf_ } = require('../src/CLI')
      await expect(togglePerfBasicProf_()).rejects.toThrow(
        'diat-linux-perf installation failed'
      )
    })
  })
})
