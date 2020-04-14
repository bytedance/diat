'use strict';

const tap = require('tap');
const { existsSync, readFileSync } = require('fs');

const linuxPerf = require('../linux-perf.js');
const mapFileName = `/tmp/perf-${process.pid}.map`;


tap.notOk(existsSync(mapFileName));

tap.ok(linuxPerf.start());
tap.notOk(linuxPerf.start());

tap.ok(existsSync(mapFileName));

function foo() {
  return true;
}
foo();

const resultRegex = /[a-z0-9]+ [a-z0-9]+ [a-zA-Z]+:foo/;

const content = readFileSync(mapFileName, { encoding: 'utf-8' });

tap.match(content, resultRegex);
