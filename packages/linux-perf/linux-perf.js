'use strict';

const binding = require('./build/Release/linux-perf');

module.exports = new binding.LinuxPerf();
