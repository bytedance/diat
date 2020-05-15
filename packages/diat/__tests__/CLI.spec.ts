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
})
