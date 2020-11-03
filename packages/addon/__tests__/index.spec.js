/* eslint-disable */
const expect = require('expect');
const mod = require('../')

describe('addon', () => {
  describe('addIncreaseHeapLimitHandler', () => {
    it('should work', () => {
      const check = (ret, expected) => {
        const is8 = process.versions.node.split('.')[0] === '8';
        if (!is8) {
          expect(ret).toBe(expected);
        }
      };

      check(mod.addIncreaseHeapLimitHandler(), true);
      check(mod.addIncreaseHeapLimitHandler(), false);
      check(mod.removeIncreaseHeapLimitHandler(), true);
      check(mod.removeIncreaseHeapLimitHandler(), false);
    });
  });
});
