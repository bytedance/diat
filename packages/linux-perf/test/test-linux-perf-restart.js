'use strict';

const tap = require('tap');
const { existsSync, readFileSync } = require('fs');

const linuxPerf = require('../linux-perf.js');
const mapFileName = `/tmp/perf-${process.pid}.map`;

linuxPerf.start();

function foo() {
  return true;
}
foo();

linuxPerf.stop();

function bar() {
  return true;
}
bar();

const resultRegex = /[a-z0-9]+ [a-z0-9]+ [a-zA-Z]+:bar/;
const content = readFileSync(mapFileName, { encoding: 'utf-8' });

tap.notMatch(content, resultRegex);

tap.ok(linuxPerf.start());

const content2 = readFileSync(mapFileName, { encoding: 'utf-8' });

tap.match(content2, resultRegex);
