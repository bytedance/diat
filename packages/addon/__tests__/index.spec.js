/* eslint-disable */
const expect = require('expect');

describe('addon', () => {
  const addon = require('../');

  describe('addIncreaseHeapLimitHandler', () => {
    const {
      addIncreaseHeapLimitHandler,
      removeIncreaseHeapLimitHandler
    } = addon;
    it('should work', () => {
      const check = (ret, expected) => {
        const is8 = process.versions.node.split('.')[0] === '8';
        if (!is8) {
          expect(ret).toBe(expected);
        }
      };

      check(addIncreaseHeapLimitHandler(), true);
      check(addIncreaseHeapLimitHandler(), false);
      check(removeIncreaseHeapLimitHandler(), true);
      check(removeIncreaseHeapLimitHandler(), false);
    });
  });
});
