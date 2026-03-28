#!/usr/bin/env node
/**
 * Browser check script — launches headless Chromium via Playwright,
 * navigates to a URL, and runs specified checks.
 *
 * Usage: node browser-check.js <url> [checks...]
 *   checks: status, title, content, elements:<selector>
 *
 * Outputs JSON results to stdout.
 */

const { chromium } = require('playwright');

async function main() {
  const [,, url, ...checks] = process.argv;

  if (!url) {
    console.error('Usage: node browser-check.js <url> [checks...]');
    process.exit(1);
  }

  const requestedChecks = checks.length > 0
    ? checks.join(',').split(',').map(c => c.trim())
    : ['status', 'title'];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const results = {};

    for (const check of requestedChecks) {
      if (check === 'status') {
        results.status = response ? response.status() : null;
      } else if (check === 'title') {
        results.title = await page.title();
      } else if (check === 'content') {
        const text = await page.textContent('body');
        results.content = text ? text.substring(0, 2000) : '';
      } else if (check.startsWith('elements:')) {
        const selector = check.substring('elements:'.length);
        const count = await page.locator(selector).count();
        results[`elements_${selector}`] = count;
      }
    }

    console.log(JSON.stringify(results));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
