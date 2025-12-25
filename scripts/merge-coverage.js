#!/usr/bin/env node
/**
 * Merge E2E (V8) coverage with Unit test coverage
 * Converts V8 format to Istanbul and merges all coverage reports
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import v8ToIstanbul from 'v8-to-istanbul';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const e2eCoverageDir = path.join(rootDir, 'coverage/e2e-tmp');
const unitCoverageDir = path.join(rootDir, 'coverage');
const mergedDir = path.join(rootDir, 'coverage/merged');

async function convertV8ToIstanbul(v8CoverageFile) {
  const v8Data = JSON.parse(fs.readFileSync(v8CoverageFile, 'utf8'));
  const istanbulCoverage = {};

  for (const entry of v8Data) {
    try {
      // Convert URL to local file path
      const url = new URL(entry.url);
      const relativePath = url.pathname; // e.g., /js/game.js
      const absolutePath = path.join(rootDir, relativePath);

      // Skip if file doesn't exist
      if (!fs.existsSync(absolutePath)) {
        continue;
      }

      // Convert V8 coverage to Istanbul format
      const converter = v8ToIstanbul(absolutePath, 0, {
        source: entry.source
      });

      await converter.load();
      converter.applyCoverage(entry.functions);
      const istanbulData = converter.toIstanbul();

      // Merge into our coverage object
      Object.assign(istanbulCoverage, istanbulData);
    } catch (err) {
      // Skip files that can't be processed
      console.warn(`Warning: Could not process ${entry.url}: ${err.message}`);
    }
  }

  return istanbulCoverage;
}

async function main() {
  console.log('Merging coverage reports...');

  // Ensure merged directory exists
  if (!fs.existsSync(mergedDir)) {
    fs.mkdirSync(mergedDir, { recursive: true });
  }

  const allCoverage = {};

  // Load unit test coverage (if exists)
  const unitCoverageFile = path.join(unitCoverageDir, 'coverage-final.json');
  if (fs.existsSync(unitCoverageFile)) {
    console.log('Loading unit test coverage...');
    const unitCoverage = JSON.parse(fs.readFileSync(unitCoverageFile, 'utf8'));
    Object.assign(allCoverage, unitCoverage);
    console.log(`  Found ${Object.keys(unitCoverage).length} files`);
  }

  // Convert and merge E2E coverage
  if (fs.existsSync(e2eCoverageDir)) {
    const e2eFiles = fs.readdirSync(e2eCoverageDir).filter(f => f.endsWith('.json'));
    console.log(`Processing ${e2eFiles.length} E2E coverage files...`);

    for (const file of e2eFiles) {
      try {
        const e2eCoverage = await convertV8ToIstanbul(path.join(e2eCoverageDir, file));

        // Merge: for each file, merge the coverage data
        for (const [filePath, fileCoverage] of Object.entries(e2eCoverage)) {
          if (allCoverage[filePath]) {
            // Merge statement, function, and branch coverage
            mergeCoverageData(allCoverage[filePath], fileCoverage);
          } else {
            allCoverage[filePath] = fileCoverage;
          }
        }
      } catch (err) {
        console.warn(`Warning: Could not process ${file}: ${err.message}`);
      }
    }
  }

  // Write merged coverage
  const mergedFile = path.join(mergedDir, 'coverage-final.json');
  fs.writeFileSync(mergedFile, JSON.stringify(allCoverage, null, 2));
  console.log(`Merged coverage written to ${mergedFile}`);
  console.log(`Total files covered: ${Object.keys(allCoverage).length}`);

  // Clean up temp E2E files
  if (fs.existsSync(e2eCoverageDir)) {
    fs.rmSync(e2eCoverageDir, { recursive: true });
    console.log('Cleaned up temporary E2E coverage files');
  }
}

function mergeCoverageData(target, source) {
  // Merge statement coverage (s)
  if (source.s) {
    for (const [key, value] of Object.entries(source.s)) {
      target.s[key] = (target.s[key] || 0) + value;
    }
  }

  // Merge function coverage (f)
  if (source.f) {
    for (const [key, value] of Object.entries(source.f)) {
      target.f[key] = (target.f[key] || 0) + value;
    }
  }

  // Merge branch coverage (b)
  if (source.b) {
    for (const [key, values] of Object.entries(source.b)) {
      if (!target.b[key]) {
        target.b[key] = values;
      } else {
        target.b[key] = target.b[key].map((v, i) => v + (values[i] || 0));
      }
    }
  }
}

main().catch(err => {
  console.error('Error merging coverage:', err);
  process.exit(1);
});
