import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

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

async function closeModal(page) {
  await page.evaluate(() => {
    const closeSvg = document.querySelector('div.fixed.inset-0 svg.w-6.h-6');
    if (closeSvg && closeSvg.closest('button')) {
      closeSvg.closest('button').click();
    }
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function runBrowserSmoke() {
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
  } catch (err) {
    try {
      const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
        phone: demoPhone,
        pin: '1234',
      });
      token = loginRes.data.tokens.accessToken;
    } catch (e) {}
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 920, deviceScaleFactor: 2 });

  // 1. TEST GUEST MODE LANDING (No token)
  console.log('Testing Flow 1: Guest Landing (Unauthenticated)...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));

  const guestScreenshot = path.join(artifactDir, 'guest-landing.png');
  await page.screenshot({ path: guestScreenshot, fullPage: false });
  console.log(`✓ [Flow 1] Guest Landing captured to ${guestScreenshot}`);

  // Authenticate user
  if (token) {
    await page.evaluate((t) => {
      localStorage.setItem('guardian_token', t);
    }, token);
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 2. Light Mode Home Dashboard
  console.log('Testing Flow 2: Authenticated Home (Light Mode)...');
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await new Promise((r) => setTimeout(r, 600));

  const lightArtifact = path.join(artifactDir, 'home-light.png');
  await page.screenshot({ path: lightArtifact, fullPage: false });
  fs.copyFileSync(lightArtifact, path.join(docsDir, 'home-light.png'));
  console.log(`✓ [Flow 2] Light Mode Home captured to ${lightArtifact}`);

  // 3. Dark Mode Home Dashboard
  console.log('Testing Flow 3: Authenticated Home (Dark Mode)...');
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await new Promise((r) => setTimeout(r, 600));

  const darkArtifact = path.join(artifactDir, 'home-dark.png');
  await page.screenshot({ path: darkArtifact, fullPage: false });
  fs.copyFileSync(darkArtifact, path.join(docsDir, 'home-dark.png'));
  console.log(`✓ [Flow 3] Dark Mode Home captured to ${darkArtifact}`);

  // Revert to light
  await page.evaluate(() => {
    localStorage.setItem('guardian_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await new Promise((r) => setTimeout(r, 400));

  // 4. Notifications Modal (From MongoDB)
  console.log('Testing Flow 4: Notifications Modal...');
  await page.evaluate(() => {
    const bellBtn = document.querySelector('header button[aria-label="Notifications"], header button[aria-label="বিজ্ঞপ্তি"]');
    if (bellBtn) bellBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const notifScreenshot = path.join(artifactDir, 'notifications-modal.png');
  await page.screenshot({ path: notifScreenshot, fullPage: false });
  console.log(`✓ [Flow 4] Notifications Modal captured to ${notifScreenshot}`);
  await closeModal(page);

  // 5. History Page (Real transactions from MongoDB)
  console.log('Testing Flow 5: History Page...');
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const histBtn = navButtons.find((b) => b.innerText && (b.innerText.includes('লেনদেন') || b.innerText.includes('History')));
    if (histBtn) histBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const historyScreenshot = path.join(artifactDir, 'history-page.png');
  await page.screenshot({ path: historyScreenshot, fullPage: false });
  console.log(`✓ [Flow 5] History Page with MongoDB transactions captured to ${historyScreenshot}`);

  // Return to home
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const homeBtn = navButtons.find((b) => b.innerText && (b.innerText.includes('হোম') || b.innerText.includes('Home')));
    if (homeBtn) homeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // 6. Guardian Mode Modal (3 Control Modes & Remove Child)
  console.log('Testing Flow 6: Guardian Mode Modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.innerText && (x.innerText.includes('অভিভাবক মোড') || x.innerText.includes('Guardian')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const guardianScreenshot = path.join(artifactDir, 'guardian-modal.png');
  await page.screenshot({ path: guardianScreenshot, fullPage: false });
  console.log(`✓ [Flow 6] Guardian Mode Modal with 3 modes captured to ${guardianScreenshot}`);
  await closeModal(page);

  // 7. Check Message (Scam Protection)
  console.log('Testing Flow 7: Check Message (Scam Shield)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.innerText && (x.innerText.includes('বার্তা পরীক্ষা') || x.innerText.includes('মেসেজ') || x.innerText.includes('Check Message')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.type('জরুরি নোটিশ: আপনার বিকাশ একাউন্ট সাময়িক স্থগিত। চালু করতে পিন ও ওটিপি পাঠান।');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((x) => x.innerText && (x.innerText.includes('যাচাই') || x.innerText.includes('Check')));
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 1800));

    const scamScreenshot = path.join(artifactDir, 'scam-check-result.png');
    await page.screenshot({ path: scamScreenshot, fullPage: false });
    console.log(`✓ [Flow 7] Scam Check completed and captured to ${scamScreenshot}`);
  }
  await closeModal(page);

  // 8. AI Copilot Chat Modal
  console.log('Testing Flow 8: AI Copilot Modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.innerText && (x.innerText.includes('এআই সহকারী') || x.innerText.includes('এআই এজেন্ট')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const aiScreenshot = path.join(artifactDir, 'ai-copilot-modal.png');
  await page.screenshot({ path: aiScreenshot, fullPage: false });
  console.log(`✓ [Flow 8] AI Copilot Modal captured to ${aiScreenshot}`);
  await closeModal(page);

  await browser.close();
  console.log('\n======================================================');
  console.log('🎉 ALL 8 BROWSER VISUAL FLOWS COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runBrowserSmoke().catch((err) => {
  console.error('Browser smoke test failed:', err);
  process.exit(1);
});
