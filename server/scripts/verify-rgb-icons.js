import path from 'path';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';

const possiblePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const executablePath = possiblePaths.find((p) => fsExists(p));

function fsExists(p) {
  try {
    const fs = require('fs');
    return fs.existsSync(p);
  } catch {
    import('fs').then(f => f.existsSync(p));
  }
}

import fs from 'fs';

async function run() {
  const browserPath = possiblePaths.find((p) => fs.existsSync(p));
  const demoPhone = '01719998877';
  let token = null;

  try {
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      phone: demoPhone,
      pin: '1234',
      name: 'সাদিয়া ইসলাম (Sadia)',
      accountType: 'CUSTOMER',
    });
    token = regRes.data.tokens.accessToken;
  } catch {
    try {
      const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
        phone: demoPhone,
        pin: '1234',
      });
      token = loginRes.data.tokens.accessToken;
    } catch (e) {
      console.error('Auth error:', e.message);
    }
  }

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.evaluate((jwt) => {
    localStorage.setItem('guardian_token', jwt);
    localStorage.setItem('guardian_lang', 'en');
    localStorage.setItem('guardian_theme', 'dark');
  }, token);

  // Helper to click bottom tab
  async function selectTab(tabName) {
    await page.evaluate((target) => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const btn = btns.find((b) => b.innerText && b.innerText.toLowerCase().includes(target.toLowerCase()));
      if (btn) btn.click();
    }, tabName);
    await new Promise((r) => setTimeout(r, 600));
  }

  // 1. Home Screen (Dark)
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-home.png') });
  console.log('1. Saved Home (Dark)');

  // 2. Open Send Money Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const btn = btns.find((b) => b.innerText && (b.innerText.includes('Send Money') || b.innerText.includes('সেন্ড মানি')));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-modal-send.png') });
  console.log('2. Saved Send Money Modal');

  // Close modal with escape or reload
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));

  // 3. More Page
  await selectTab('More');
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-more.png') });
  console.log('3. Saved More Page');

  // 4. Account Page
  await selectTab('Account');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-account.png') });
  console.log('4. Saved Account Page');

  // 5. History Page
  await selectTab('History');
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-history.png') });
  console.log('5. Saved History Page');

  // 6. AI Copilot Modal
  const robotBtn = (await page.$('button[aria-label="AI Agent"]')) || (await page.$('button[aria-label="এআই সহকারী"]'));
  if (robotBtn) {
    await robotBtn.click();
    console.log('Clicked AI robot button');
  } else {
    console.log('Robot button not found');
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-ai-copilot.png') });
  console.log('6. Saved AI Copilot Modal');

  // Close modal
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  // 7. Home Screen in Light Mode
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'rgb-icons-home-light.png') });
  console.log('7. Saved Home (Light)');

  await browser.close();
  console.log('Verification finished completely!');
}

run().catch(console.error);
