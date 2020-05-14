'use strict';
const { test } = require('tap');
const startCLI = require('./start-cli');

test('attachConsole', (t) => {
  const cli = startCLI(['examples/alive.js']);

  function onFatal(error) {
    cli.quit();
    throw error;
  }

  return cli.waitForInitialBreak()
    .then(() => cli.waitForPrompt())
    .then(() => cli.command('c'))
    .then(() =>
      cli.command('exec setInterval(() => { console.log("hello") }, 100)'))
    .then(() => cli.writeLine('attachConsole'))
    .then(() => cli.waitFor(/leave console repl/))
    .then(() => {
      t.match(
        cli.output,
        'Press Ctrl + C to leave console repl',
        'shows hint for how to leave repl');
      t.notMatch(cli.output, 'debug>', 'changes the repl style');
    })
    .then(() => cli.waitFor(/hello/))
    .then(() => cli.waitFor(/hello/))
    .then(() => cli.quit())
    .then(null, onFatal);
});
