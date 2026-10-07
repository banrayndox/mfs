import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';
const docsDir = path.resolve('docs/screenshots');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Locate local browser binary
const possiblePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const executablePath = possiblePaths.find((p) => fs.existsSync(p));

if (!executablePath) {
  console.error('❌ Could not locate Chrome or Edge executable.');
  process.exit(1);
}

console.log(`Using browser binary: ${executablePath}`);

async function capture() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 860, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });

  // 1. Light Mode Capture
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await new Promise((r) => setTimeout(r, 600));

  const lightArtifact = path.join(artifactDir, 'home-light.png');
  const lightDocs = path.join(docsDir, 'home-light.png');

  await page.screenshot({ path: lightArtifact, fullPage: false });
  fs.copyFileSync(lightArtifact, lightDocs);
  console.log(`✓ Saved Light Mode screenshot to ${lightArtifact}`);

  // 2. Dark Mode Capture
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await new Promise((r) => setTimeout(r, 600));

  const darkArtifact = path.join(artifactDir, 'home-dark.png');
  const darkDocs = path.join(docsDir, 'home-dark.png');

  await page.screenshot({ path: darkArtifact, fullPage: false });
  fs.copyFileSync(darkArtifact, darkDocs);
  console.log(`✓ Saved Dark Mode screenshot to ${darkArtifact}`);

  await browser.close();
  console.log('All screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
