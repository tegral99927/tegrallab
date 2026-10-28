/**
 * Node.js CLI Test Runner for MTGCollectionSummary
 */

const fs = require('fs');
const path = require('path');

// Setup browser globals on Node's global object
global.window = global;
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => []
};

// Helper to eval file in global scope
function loadScript(relPath) {
  const filePath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(filePath, 'utf8');
  const fn = new Function('window', 'document', 'module', 'exports', code);
  fn(global, global.document, { exports: {} }, {});
}

// Load scripts in order
loadScript('js/utils.js');
loadScript('js/scryfall.js');
loadScript('js/deck-validator.js');
loadScript('js/importer.js');
loadScript('js/exporter.js');
loadScript('js/statistics.js');
loadScript('js/summary.js');
loadScript('js/collection.js');
loadScript('js/deckbuilder.js');
loadScript('tests/test-suite.js');

async function main() {
  console.log('====================================================');
  console.log('🧪 Running MTGCollectionSummary Unit & Integration Tests');
  console.log('====================================================\n');

  const runner = global.TestRunnerInstance;
  if (!runner) {
    console.error('TestRunnerInstance not found');
    process.exit(1);
  }

  const result = await runner.run((res, cur, total) => {
    const symbol = res.passed ? '✓' : '✕';
    console.log(`[${cur}/${total}] ${symbol} ${res.name} (${res.duration}ms)`);
    if (!res.passed) {
      console.error(`    Error: ${res.error.message}\n${res.error.stack}`);
    }
  });

  console.log('\n====================================================');
  console.log(`Results: Total: ${result.total} | Passed: ${result.passed} | Failed: ${result.failed}`);
  console.log('====================================================');

  if (result.failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed successfully!\n');
  }
}

main().catch(err => {
  console.error('Runner fatal error:', err);
  process.exit(1);
});
