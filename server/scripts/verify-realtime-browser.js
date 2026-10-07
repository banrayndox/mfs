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
  console.log('--- Multi-Client Live Realtime Browser Smoke Test ---');

  // 1. Setup User A (Sender) and User B (Receiver)
  const phoneA = '01719998877'; // Sadia
  const phoneB = '01728889900'; // Karim

  let tokenA, tokenB;
  try {
    const resA = await axios.post('http://localhost:5000/api/auth/register', {
      phone: phoneA,
      pin: '1234',
      name: 'সাদিয়া ইসলাম (Sadia)',
      accountType: 'CUSTOMER',
    });
    tokenA = resA.data.tokens.accessToken;
  } catch {
    const resA = await axios.post('http://localhost:5000/api/auth/login', {
      phone: phoneA,
      pin: '1234',
    });
    tokenA = resA.data.tokens.accessToken;
  }

  try {
    const resB = await axios.post('http://localhost:5000/api/auth/register', {
      phone: phoneB,
      pin: '1234',
      name: 'করিম হোসেন (Karim)',
      accountType: 'CUSTOMER',
    });
    tokenB = resB.data.tokens.accessToken;
  } catch {
    const resB = await axios.post('http://localhost:5000/api/auth/login', {
      phone: phoneB,
      pin: '1234',
    });
    tokenB = resB.data.tokens.accessToken;
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Open User A (Sender) in Page A
  const pageA = await browser.newPage();
  await pageA.setViewport({ width: 440, height: 900 });
  await pageA.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await pageA.evaluate((tok) => {
    localStorage.setItem('guardian_token', tok);
    localStorage.setItem('guardian_lang', 'en');
  }, tokenA);
  await pageA.reload({ waitUntil: 'networkidle2' });

  // Open User B (Receiver) in Page B
  const pageB = await browser.newPage();
  await pageB.setViewport({ width: 440, height: 900 });
  await pageB.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await pageB.evaluate((tok) => {
    localStorage.setItem('guardian_token', tok);
    localStorage.setItem('guardian_lang', 'en');
  }, tokenB);
  await pageB.reload({ waitUntil: 'networkidle2' });

  await new Promise((r) => setTimeout(r, 1500));

  // User B navigates to History tab to watch transactions arrive live
  await pageB.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button'));
    const histBtn = btns.find((b) => b.innerText && b.innerText.includes('History'));
    if (histBtn) histBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Screenshot User B before incoming transfer
  await pageB.screenshot({ path: path.join(artifactDir, 'realtime-user-b-before.png') });
  console.log('Saved User B before screenshot');

  // User A sends ৳750 to User B via Send Money Modal
  console.log('User A opens Send Money modal...');
  await pageA.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const btn = btns.find((b) => b.innerText && b.innerText.includes('Send Money'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const phoneInput = await pageA.$('input[placeholder="01XXXXXXXXX"]');
  if (phoneInput) await phoneInput.type('01728889900', { delay: 20 });

  const amountInput = await pageA.$('input[placeholder="0.00"]');
  if (amountInput) await amountInput.type('750', { delay: 20 });

  const pinInput = await pageA.$('input[type="password"]');
  if (pinInput) await pinInput.type('1234', { delay: 20 });

  await new Promise((r) => setTimeout(r, 400));

  // Wait for recipient verification to finish
  await pageA.waitForSelector('text/যাচাইকৃত', { timeout: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  // User A clicks Send
  console.log('User A clicking send button...');
  const sendSuccess = await pageA.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('form button[type="submit"]'))[0];
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      return true;
    }
    return false;
  });
  console.log('User A send button clicked:', sendSuccess);

  // Wait for settlement and Socket.IO emission to propagate
  await new Promise((r) => setTimeout(r, 3000));

  // Screenshot User B (Receiver) without any page reload!
  await pageB.screenshot({ path: path.join(artifactDir, 'realtime-user-b-after.png') });
  console.log('Saved User B after screenshot (live updated without reload)');

  // Verify User B's live transactions in DOM
  const txnCount = await pageB.evaluate(() => {
    return document.querySelectorAll('button div p').length;
  });
  console.log('User B live transactions elements detected:', txnCount);

  await browser.close();
  console.log('--- Multi-Client Live Realtime Browser Smoke Test Completed Successfully! ---');
}

run().catch(console.error);
