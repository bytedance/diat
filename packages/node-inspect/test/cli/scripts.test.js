'use strict';
const Path = require('path');

const { test } = require('tap');

const startCLI = require('./start-cli');

test('list scripts', (t) => {
  const script = Path.join('examples', 'three-lines.js');
  const cli = startCLI([script]);

  function onFatal(error) {
    cli.quit();
    throw error;
  }

  return cli.waitForInitialBreak()
    .then(() => cli.waitForPrompt())
    .then(() => cli.command('scripts'))
    .then(() => {
      t.match(
        cli.output,
        /^\* \d+: examples(?:\/|\\)three-lines\.js/,
        'lists the user script');
      t.notMatch(
        cli.output,
        /\d+: buffer\.js <native>/,
        'omits node-internal scripts');
    })
    .then(() => cli.command('scripts(true)'))
    .then(() => {
      t.match(
        cli.output,
        /\* \d+: examples(?:\/|\\)three-lines\.js/,
        'lists the user script');
      t.match(
        cli.output,
        /\d+: buffer\.js <native>/,
        'includes node-internal scripts');
    })
    .then(() => cli.quit())
    .then(null, onFatal);
});

test('get scripts', (t) => {
  const script = Path.join('examples', 'three-lines.js');
  const cli = startCLI([script]);

  function onFatal(error) {
    cli.quit();
    throw error;
  }

  return cli.waitForInitialBreak()
    .then(() => cli.waitForPrompt())
    .then(() => cli.command('getScripts()'))
    .then(() => {
      t.match(
        cli.output,
        /url.+examples(?:\/|\\)three-lines\.js/,
        'return the url of user scripts');
      t.match(
        cli.output,
        /scriptId.+\d+/,
        'return the scriptId of user scripts');
    })
    .then(() => cli.quit())
    .then(null, onFatal);
});

test('scriptSource', (t) => {
  const script = Path.join('examples', 'alive.js');
  const cli = startCLI([script]);

  function onFatal(error) {
    cli.quit();
    throw error;
  }

  return cli.waitForInitialBreak()
    .then(() => cli.waitForPrompt())
    .then(() => cli.command('scripts'))
    .then(() => {
      t.match(
        cli.output,
        /\* \d+: examples(?:\/|\\)alive\.js/,
        'get source of the script');
      const ret = /\* (\d+): examples(?:\/|\\)alive\.js/.exec(cli.output);
      return ret[1];
    })
    .then((scriptId) => cli.command(`scriptSource("${scriptId}")`))
    .then(() => {
      t.match(cli.output, /1 let x = 0/, 'print source of the script');
    })
    .then(() => cli.command('scriptSource("alive.js")'))
    .then(() => {
      t.match(cli.output, /1 let x = 0/, 'print source of the script');
    })
    .then(() => cli.quit())
    .then(null, onFatal);
});
