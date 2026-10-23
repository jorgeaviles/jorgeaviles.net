import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Original vector artwork, rasterized for social clients that require a PNG.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;width:1200px;height:630px}svg{display:block}</style>${await readFile('public/social-preview.svg', 'utf8')}`,
  );
  await page.screenshot({ path: 'public/social-preview.png' });
} finally {
  await browser.close();
}
