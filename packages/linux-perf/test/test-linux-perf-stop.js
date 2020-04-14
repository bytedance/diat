'use strict';

const tap = require('tap');
const { existsSync, readFileSync } = require('fs');

const linuxPerf = require('../linux-perf.js');
const mapFileName = `/tmp/perf-${process.pid}.map`;

tap.notOk(linuxPerf.stop());

linuxPerf.start();

function foo() {
  return true;
}
foo();

tap.ok(linuxPerf.stop());

function bar() {
  return true;
}
bar();

const resultRegex = /[a-z0-9]+ [a-z0-9]+ [a-zA-Z]+:bar/;

const content = readFileSync(mapFileName, { encoding: 'utf-8' });

tap.notMatch(content, resultRegex);
