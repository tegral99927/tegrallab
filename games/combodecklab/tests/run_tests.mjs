// run_tests.mjs - CLI test runner for Node.js

import { runEngineTests } from "./engine/engine.test.js";
import { runCardTests } from "./cards/cards.test.js";
import { runIntegrationTests } from "./scenarios/integration.test.js";
import { CardCache } from "../js/api/cache.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-load card metadata into CardCache
const metaPath = path.join(__dirname, "../data/cards/card-metadata.json");
if (fs.existsSync(metaPath)) {
  const json = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  CardCache.populateBulk(json);
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function createRunner(suiteName) {
  console.log(`\n=== ${suiteName} ===`);
  return {
    ok(val, desc) {
      totalTests++;
      if (val) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc} (Expected truthy)`);
      }
    },
    notOk(val, desc) {
      totalTests++;
      if (!val) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc} (Expected falsy)`);
      }
    },
    equal(a, b, desc) {
      totalTests++;
      if (a === b) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc} (Expected ${b}, got ${a})`);
      }
    },
    notEqual(a, b, desc) {
      totalTests++;
      if (a !== b) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc} (Expected different values)`);
      }
    },
    deepEqual(a, b, desc) {
      totalTests++;
      const match = JSON.stringify(a) === JSON.stringify(b);
      if (match) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc}\n    Expected: ${JSON.stringify(b)}\n    Got:      ${JSON.stringify(a)}`);
      }
    },
    notDeepEqual(a, b, desc) {
      totalTests++;
      const match = JSON.stringify(a) === JSON.stringify(b);
      if (!match) {
        passedTests++;
        console.log(`  ✓ ${desc}`);
      } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${desc} (Expected different structures)`);
      }
    }
  };
}

console.log("Starting Combo Deck Lab Automated Tests...");

try {
  runEngineTests(createRunner("1. 共通ゲームエンジン・ルール"));
  runCardTests(createRunner("2. 個別カード機能・例外処理"));
  runIntegrationTests(createRunner("3. MoMa & Lotus Field 統合コンボシナリオ"));

  console.log("\n==========================================");
  if (failedTests === 0) {
    console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests} tests successful)`);
    process.exit(0);
  } else {
    console.error(`❌ SOME TESTS FAILED: ${failedTests} failed, ${passedTests} passed of ${totalTests} total.`);
    process.exit(1);
  }
} catch (e) {
  console.error("FATAL TEST RUNNER ERROR:", e);
  process.exit(1);
}
