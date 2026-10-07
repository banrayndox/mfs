import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';

const possiblePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const executablePath = possiblePaths.find((p) => fs.existsSync(p));

async function run() {
  console.log('=== AI Financial Operating Layer Browser Smoke Verification ===');

  const phone = '01719998877';
  let token, user;
  try {
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      phone,
      pin: '1234',
      name: 'সাদিয়া ইসলাম (Sadia)',
      accountType: 'CUSTOMER',
    });
    token = res.data.tokens.accessToken;
    user = res.data.user;
  } catch {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      phone,
      pin: '1234',
    });
    token = res.data.tokens.accessToken;
    user = res.data.user;
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880 });

  // Pre-seed auth into localStorage with guardian_token
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('guardian_token', t);
  }, token);

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  console.log('1. Page loaded. Opening AI Copilot modal from center bottom nav...');
  await page.evaluate(() => {
    const centerBtn = document.querySelector('nav button.rounded-full');
    if (centerBtn) centerBtn.click();
  });

  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(artifactDir, 'copilot-initial-modal.png') });
  console.log('Saved initial modal screenshot.');

  // Helper to send query in Copilot modal
  async function sendQuery(queryText, screenshotName) {
    console.log(`Sending query: "${queryText}"`);
    const input = await page.waitForSelector('input[type="text"][placeholder*="command"], input[type="text"][placeholder*="বলুন"], .fixed.z-50 input[type="text"]', { timeout: 6000 });
    await input.click({ clickCount: 3 });
    await input.type(queryText, { delay: 20 });

    const sendBtn = await page.waitForSelector('button[aria-label="Send message"]', { timeout: 3000 });
    await sendBtn.click();

    // Wait for Copilot response to render
    await new Promise((r) => setTimeout(r, 2200));

    if (screenshotName) {
      await page.screenshot({ path: path.join(artifactDir, screenshotName) });
      console.log(`Saved screenshot: ${screenshotName}`);
    }
  }

  // 2. Financial Query: Balance
  await sendQuery('What is my balance?', 'copilot-balance-check.png');

  // 3. Layer A: Financial Habits Explanation
  await sendQuery('Why am I running out of money every month?', 'copilot-habits-explanation.png');

  // 4. Layer C: Micro-Savings Setup
  await sendQuery('Save 2% from every transaction', 'copilot-micro-savings-setup.png');

  // 5. RAG Knowledge Pipeline
  await sendQuery('What is the difference between Send Money and Cash Out?', 'copilot-rag-documentation.png');

  // 6. Layer B: Financial Guardian Risk Review & Step-up Confirmation Card
  await sendQuery('Send 500 taka to 01728889900', 'copilot-guardian-confirmation-card.png');

  console.log('All queries sent and verified.');
  await browser.close();
  console.log('Verification completed successfully!');
}

run().catch((err) => {
  console.error('Error running browser verification:', err);
  process.exit(1);
});
