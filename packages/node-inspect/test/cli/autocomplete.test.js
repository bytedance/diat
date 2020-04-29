'use strict';
const { test } = require('tap');

const startCLI = require('./start-cli');

test('examples/alive.js', (t) => {
  const cli = startCLI(['examples/alive.js']);

  function onFatal(error) {
    cli.quit();
    throw error;
  }

  return cli.waitForInitialBreak()
    .then(() => cli.waitForPrompt())
    .then(() => cli.command('repl'))
    .then(() => cli.waitForPrompt())
    .then(() => cli.completer(''))
    .then(() => cli.waitFor(/Array/))
    .then(() => cli.completer('process.'))
    .then(() => cli.waitFor(/process\.versions/))
    .then(() => {
      t.match(
        cli.output,
        'process.version',
        'could access property of "version" from "process"');
    })
    .then(() => cli.completer('process.version'))
    .then(() => cli.waitFor(/process\.versions/))
    .then(() => {
      t.match(
        cli.output,
        'process',
        '"process" should have both properties of "version" '
          + 'and "versions" when search for "version"');
    })
    .then(() => cli.quit())
    .then(null, onFatal);
});
