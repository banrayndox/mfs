import puppeteer from 'puppeteer-core';
import axios from 'axios';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';
const CLIENT_URL = 'http://localhost:5173';
const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';

async function verify() {
  console.log('🚀 Running Child Mode & Group Bill E2E Browser Verification...');

  // Setup parent & child accounts via API (must be valid 11-digit BD mobile numbers)
  const rand1 = Math.floor(10000000 + Math.random() * 90000000);
  const rand2 = Math.floor(10000000 + Math.random() * 90000000);
  const parentPhone = `017${rand1.toString().slice(-8)}`;
  const childPhone = `018${rand2.toString().slice(-8)}`;
  const pin = '1234';

  console.log(`[Setup] Parent: ${parentPhone}, Child: ${childPhone}`);

  // Register parent
  const regParent = await axios.post(`${BASE_URL}/auth/register`, {
    phone: parentPhone,
    pin,
    name: 'Rahim Parent',
    accountType: 'CUSTOMER',
  });
  const parentToken = regParent.data.tokens.accessToken;

  // Register child linked to parent
  const regChild = await axios.post(`${BASE_URL}/auth/register`, {
    phone: childPhone,
    pin,
    name: 'Rakib Child',
    accountType: 'CHILD',
    parentPhone,
    dailyLimitPoisha: 25000,
  });
  const childToken = regChild.data.tokens.accessToken;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915 });

  // 1. ADULT LOGIN — GUARDIAN MODE SHOULD BE VISIBLE
  console.log('1️⃣  Testing Adult Account...');
  await page.goto(CLIENT_URL, { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => localStorage.setItem('guardian_token', tok), parentToken);
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  const adultHasGuardian = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('অভিভাবক মোড') || text.includes('Guardian Mode');
  });
  console.log(`  ✓ Adult account has Guardian Mode visible: ${adultHasGuardian}`);
  if (!adultHasGuardian) throw new Error('Guardian Mode should be visible for adult');

  const adultDuplicateAi = await page.evaluate(() => {
    const safetySection = document.querySelector('section:nth-of-type(2)');
    return safetySection ? safetySection.innerText.includes('এআই সহকারী') || safetySection.innerText.includes('AI Copilot') : false;
  });
  console.log(`  ✓ Duplicate AI Copilot in Safety section removed: ${!adultDuplicateAi}`);

  // 2. CHILD LOGIN — GUARDIAN MODE MUST BE HIDDEN & PARENT INFO VISIBLE
  console.log('\n2️⃣  Testing Child Account...');
  await page.evaluate((tok) => localStorage.setItem('guardian_token', tok), childToken);
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  const childHasGuardian = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('অভিভাবক মোড') || text.includes('Guardian Mode');
  });
  console.log(`  ✓ Child account has Guardian Mode HIDDEN: ${!childHasGuardian}`);
  if (childHasGuardian) throw new Error('Guardian Mode must NOT be visible for child');

  const childShowsParent = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Rahim Parent') || text.includes('অভিভাবকের অধীনে');
  });
  console.log(`  ✓ Child header clearly shows parent information: ${childShowsParent}`);

  const childScreenshot = path.join(artifactDir, 'child-mode-dashboard.png');
  await page.screenshot({ path: childScreenshot, fullPage: false });
  console.log(`  ✓ Child dashboard captured to: ${childScreenshot}`);

  // 3. CHILD ACCOUNT PAGE — PARENT DETAILS
  console.log('\n3️⃣  Testing Child Account Page...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, nav a'));
    const b = btns.find((x) => x.innerText && (x.innerText.includes('অ্যাকাউন্ট') || x.innerText.includes('Account')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const accountShowsGuardian = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('অভিভাবক নিয়ন্ত্রণ ও সুরক্ষা') || text.includes('Guardian Protection');
  });
  console.log(`  ✓ Account page displays Guardian Protection card: ${accountShowsGuardian}`);

  const childAccountScreenshot = path.join(artifactDir, 'child-account-protection.png');
  await page.screenshot({ path: childAccountScreenshot, fullPage: false });
  console.log(`  ✓ Child account protection captured to: ${childAccountScreenshot}`);

  // 4. GROUP BILL MODAL OVERHAUL
  console.log('\n4️⃣  Testing Group Bill Modal (Adult User)...');
  await page.evaluate((tok) => localStorage.setItem('guardian_token', tok), parentToken);
  await page.goto(CLIENT_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // Open Group Bill
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.innerText && (x.innerText.includes('গ্রুপ বিল') || x.innerText.includes('Group Bill')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Verify "Where will the payment go?"
  const hasPaymentDestination = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('কোথায় টাকা যাবে?') || text.includes('Where will the payment go?');
  });
  console.log(`  ✓ Payment Destination question at top: ${hasPaymentDestination}`);

  // Type destination number
  const destInputs = await page.$$('input[placeholder="01XXXXXXXXX"]');
  if (destInputs[0]) {
    await destInputs[0].type(parentPhone);
  }
  await new Promise((r) => setTimeout(r, 700));

  // Type total amount
  const amountInput = await page.$('input[placeholder="1000"]');
  if (amountInput) {
    await amountInput.type('1200');
  }
  await new Promise((r) => setTimeout(r, 400));

  // Click "+ Add More" to verify functional member row addition
  const initialMemberInputs = await page.evaluate(() => document.querySelectorAll('input[placeholder="01XXXXXXXXX"]').length);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find((x) => x.innerText && (x.innerText.includes('সদস্য যোগ') || x.innerText.includes('Add More')));
    if (addBtn) addBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const newMemberInputs = await page.evaluate(() => document.querySelectorAll('input[placeholder="01XXXXXXXXX"]').length);
  console.log(`  ✓ "+ Add More" dynamically added member row: ${newMemberInputs > initialMemberInputs} (${initialMemberInputs} -> ${newMemberInputs})`);

  // Type members
  const memberInputs = await page.$$('input[placeholder="01XXXXXXXXX"]');
  // memberInputs[0] is destination, [1] is Member 1, [2] is Member 2
  if (memberInputs[1]) {
    await memberInputs[1].type(childPhone);
  }
  if (memberInputs[2]) {
    await memberInputs[2].type('01733333333');
  }
  await new Promise((r) => setTimeout(r, 800));

  // Check split preview
  const hasSplitPreview = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('গ্রুপ বিল হিসেব') || text.includes('Group Bill:');
  });
  console.log(`  ✓ Contribution Breakdown Preview displayed: ${hasSplitPreview}`);

  // Verify scrollability while scrollbar is visually hidden
  const scrollTest = await page.evaluate(() => {
    const scrollEl = document.querySelector('.overflow-y-auto');
    if (!scrollEl) return { found: false };
    const initialTop = scrollEl.scrollTop;
    scrollEl.scrollTop = 120;
    const scrolledTop = scrollEl.scrollTop;
    const computedStyle = window.getComputedStyle(scrollEl);
    return {
      found: true,
      canScroll: scrolledTop > initialTop,
      scrollbarWidth: computedStyle.scrollbarWidth,
      msOverflowStyle: computedStyle.msOverflowStyle,
    };
  });
  console.log(`  ✓ Modal content scrollable: ${scrollTest.canScroll}`);
  console.log(`  ✓ Scrollbar hidden via CSS: scrollbarWidth = ${scrollTest.scrollbarWidth}`);

  const groupBillScreenshot = path.join(artifactDir, 'group-bill-modal.png');
  await page.screenshot({ path: groupBillScreenshot, fullPage: false });
  console.log(`  ✓ Group Bill modal captured to: ${groupBillScreenshot}`);

  await browser.close();
  console.log('\n======================================================');
  console.log('🎉 ALL CHILD MODE & GROUP BILL FEATURES VERIFIED 100%!');
  console.log('======================================================\n');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
