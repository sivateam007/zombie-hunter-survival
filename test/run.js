/* Sequential test runner: `npm test` */
'use strict';
const path = require('path');

const FILES = [
  'levels.test.js',
  'parity.test.js',
  'aim.test.js',
  'sim.test.js',
  'density.test.js',
  'waves.test.js',
  'jetpack.test.js',
  'storage.test.js',
  'ledger.test.js',
  'missions.test.js',
  'server.test.js'
];

(async function run() {
  const started = Date.now();
  for (const file of FILES) {
    try {
      const result = require(path.join(__dirname, file));
      if (result && typeof result.then === 'function') await result;
    } catch (err) {
      console.error('\n✗ ' + file + ' failed\n');
      console.error(err && err.stack ? err.stack : err);
      process.exit(1);
    }
  }
  const ms = Date.now() - started;
  console.log('\nAll checks passed in ' + ms + 'ms');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
