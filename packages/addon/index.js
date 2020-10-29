const bindings = require('bindings');
const {
  addIncreaseHeapLimitHandler,
  removeIncreaseHeapLimitHandler
} = bindings({ bindings: 'addon.node' });

function hasNativeMethod() {
  return Number(process.versions.modules) >= 64;
}

const emptyFunc = () => null;

module.exports = {
  addIncreaseHeapLimitHandler: hasNativeMethod()
    ? addIncreaseHeapLimitHandler
    : emptyFunc,
  removeIncreaseHeapLimitHandler: hasNativeMethod()
    ? removeIncreaseHeapLimitHandler
    : emptyFunc
};
