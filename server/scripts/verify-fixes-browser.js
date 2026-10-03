import puppeteer from 'puppeteer-core';
import axios from 'axios';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';
const CLIENT_URL = 'http://localhost:5173';
const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';

async function run() {
  console.log('🚀 Running Comprehensive Browser Smoke Verification for Fixes...');

  const rand = Math.floor(10000000 + Math.random() * 90000000);
  const userPhone = `017${rand.toString().slice(-8)}`;
  const initialPin = '1234';

  console.log(`[Setup] User: ${userPhone}`);

  // Register user
  const regUser = await axios.post(`${BASE_URL}/auth/register`, {
    phone: userPhone,
    pin: initialPin,
    name: 'Sultan Tester',
    accountType: 'CUSTOMER',
  });
  const token = regUser.data.tokens.accessToken;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915 });

  await page.goto(CLIENT_URL, { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => localStorage.setItem('guardian_token', tok), token);
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));

  // ================= 1. SCHEDULE CONFIRMATION TEST =================
  console.log('\n1️⃣  Testing Schedule Creation & Confirmation...');
  // Open Scheduled & Rules Modal from Home
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
    const schedBtn = btns.find((b) => b.innerText && (b.innerText.includes('শিডিউল ও রুলস') || b.innerText.includes('Schedules')));
    if (schedBtn) schedBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click "+ নতুন তৈরি করুন" (Add new schedule)
  await page.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button'));
    const addBtn = addBtns.find((b) => b.innerText && b.innerText.includes('নতুন তৈরি করুন'));
    if (addBtn) addBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Fill in schedule form using page.type so React state updates
  const recipientInput = await page.$('input[placeholder="01XXXXXXXXX"]');
  if (recipientInput) {
    await recipientInput.type('01799887766', { delay: 20 });
  }

  const amountInput = await page.$('input[placeholder="500"]');
  if (amountInput) {
    await amountInput.type('350', { delay: 20 });
  }

  const schedPinInput = await page.$('form input[type="password"]');
  if (schedPinInput) {
    await schedPinInput.type('1234', { delay: 20 });
  }
  await new Promise((r) => setTimeout(r, 400));


  // Submit schedule
  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText && (b.innerText.includes('শিডিউল কনফার্ম করুন') || b.innerText.includes('Confirm')));
    if (submitBtn) submitBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Check UI feedback and schedule list
  const schedResult = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasSuccess: text.includes('শিডিউল সফলভাবে তৈরি হয়েছে') || text.includes('Schedule created successfully'),
      hasError: text.includes('Step-up authorization failed') || text.includes('anti-replay violation') || text.includes('ব্যর্থ হয়েছে'),
      errorText: document.querySelector('.bg-rose-50')?.innerText || '',
    };
  });

  console.log(`  ✓ Schedule confirmation success: ${schedResult.hasSuccess}`);
  console.log(`  ✓ No action hash or anti-replay error: ${!schedResult.hasError}`);
  if (schedResult.hasError) {
    throw new Error(`Schedule confirmation failed: ${schedResult.errorText}`);
  }

  // Verify in MongoDB via API
  const schedApiRes = await axios.get(`${BASE_URL}/schedules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const schedulesInDb = schedApiRes.data.schedules || [];
  console.log(`  ✓ Schedules in MongoDB: ${schedulesInDb.length} (status: ${schedulesInDb[0]?.status})`);
  if (schedulesInDb.length === 0 || schedulesInDb[0]?.status !== 'active') {
    throw new Error('Schedule was not persisted as active in MongoDB.');
  }

  // ================= 2. CONDITIONAL RULE CONFIRMATION TEST =================
  console.log('\n2️⃣  Testing Conditional Rule Creation & Confirmation...');
  // Switch to Rules tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const rulesTab = tabs.find((b) => b.innerText && b.innerText.includes('শর্তযুক্ত রুল'));
    if (rulesTab) rulesTab.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Click "+ নতুন তৈরি করুন" for rule
  await page.evaluate(() => {
    const addBtns = Array.from(document.querySelectorAll('button'));
    const addBtn = addBtns.find((b) => b.innerText && b.innerText.includes('নতুন তৈরি করুন'));
    if (addBtn) addBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Fill in rule form using page.type so React state updates
  const minInput = await page.$('input[placeholder="1000"]');
  const acInput = await page.$('input[placeholder="A/C No"]');
  const ruleAmountInput = await page.$('input[placeholder="500"]');
  const rulePwInputs = await page.$$('input[type="password"]');
  const rulePinInput = rulePwInputs[rulePwInputs.length - 1];


  console.log(`  [Debug] Rule inputs: min=${!!minInput}, ac=${!!acInput}, amt=${!!ruleAmountInput}, pin=${!!rulePinInput}, totalPw=${rulePwInputs.length}`);


  if (minInput) await minInput.type('1500', { delay: 20 });
  if (acInput) await acInput.type('442109', { delay: 20 });
  if (ruleAmountInput) await ruleAmountInput.type('600', { delay: 20 });
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('form input'));
    const pw = inputs.find((i) => i.type === 'password');
    if (pw) {
      pw.scrollIntoView();
      pw.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(pw, '1234');
      pw.dispatchEvent(new Event('input', { bubbles: true }));
      pw.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 600));




  // Submit rule
  const btnInfo = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText && b.innerText.includes('শর্তযুক্ত রুল সংরক্ষণ'));
    return {
      exists: !!btn,
      disabled: btn ? btn.disabled : null,
      text: btn ? btn.innerText : null,
      formPinValue: document.querySelector('form input[type="password"]')?.value,
    };
  });
  console.log('  [Debug] Submit button info:', btnInfo);

  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText && b.innerText.includes('শর্তযুক্ত রুল সংরক্ষণ'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));



  // Check UI feedback
  const ruleResult = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasSuccess: text.includes('শর্তযুক্ত রুল সফলভাবে সংরক্ষিত হয়েছে') || text.includes('Rule created successfully'),
      hasError: text.includes('Step-up authorization failed') || text.includes('anti-replay violation') || text.includes('ব্যর্থ হয়েছে'),
      errorText: document.querySelector('.bg-rose-50')?.innerText || '',
    };
  });

  console.log(`  ✓ Rule confirmation success: ${ruleResult.hasSuccess}`);
  console.log(`  ✓ No action hash or anti-replay error: ${!ruleResult.hasError}`);
  if (ruleResult.hasError) {
    throw new Error(`Rule confirmation failed: ${ruleResult.errorText}`);
  }

  // Verify in MongoDB via API
  const ruleApiRes = await axios.get(`${BASE_URL}/schedules/rules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rulesInDb = ruleApiRes.data.rules || [];
  console.log(`  ✓ Rules in MongoDB: ${rulesInDb.length} (status: ${rulesInDb[0]?.status})`);
  if (rulesInDb.length === 0 || rulesInDb[0]?.status !== 'active') {
    throw new Error('Rule was not persisted as active in MongoDB.');
  }

  // Close scheduled rules modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find((b) => b.innerHTML.includes('svg'));
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // ================= 3. CHANGE PIN UI, SCROLLBAR & TOP STRIP TEST =================
  console.log('\n3️⃣  Testing Change PIN Modal (Scrollbar & Top Strip)...');
  // Navigate to More page
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button, footer button'));
    const moreBtn = btns.find((b) => b.innerText.includes('আরও') || b.innerText.includes('More'));
    if (moreBtn) moreBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Click Change PIN
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pinBtn = btns.find((b) => b.innerText && (b.innerText.includes('পিন পরিবর্তন') || b.innerText.includes('Change PIN')));
    if (pinBtn) pinBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Inspect layout & styling of Change PIN modal
  const pinModalLayout = await page.evaluate(() => {
    const modal = document.querySelector('.fixed.z-50');
    if (!modal) return { error: 'Modal not found' };
    const rect = modal.getBoundingClientRect();
    const style = window.getComputedStyle(modal);

    const innerCard = modal.querySelector('div');
    const innerStyle = innerCard ? window.getComputedStyle(innerCard) : null;

    // Check element at (200, 5) to verify top edge has backdrop
    const topEl = document.elementFromPoint(200, 5);

    return {
      modalTop: rect.top,
      modalMarginTop: style.marginTop,
      topElementTag: topEl?.tagName,
      topElementClass: topEl?.className?.slice(0, 30),
      innerOverflowY: innerStyle?.overflowY,
      innerScrollbarWidth: innerStyle?.scrollbarWidth,
      bodyOverflowY: window.getComputedStyle(document.body).overflowY,
    };
  });

  console.log(`  ✓ Modal starts cleanly at y=0: ${pinModalLayout.modalTop === 0} (top: ${pinModalLayout.modalTop}px)`);
  console.log(`  ✓ Modal margin-top is 0px (no space-y pushdown): ${pinModalLayout.modalMarginTop === '0px'}`);
  console.log(`  ✓ Top edge covered by modal overlay: ${pinModalLayout.topElementTag === 'DIV'}`);
  console.log(`  ✓ Inner card overflow is scrollable: ${pinModalLayout.innerOverflowY === 'auto'}`);
  console.log(`  ✓ Inner scrollbar visually hidden: ${pinModalLayout.innerScrollbarWidth === 'none'}`);
  console.log(`  ✓ Background body scroll locked: ${pinModalLayout.bodyOverflowY === 'hidden'}`);

  if (pinModalLayout.modalTop !== 0 || pinModalLayout.modalMarginTop !== '0px') {
    throw new Error(`Change PIN modal has unwanted top offset/margin: top=${pinModalLayout.modalTop}, marginTop=${pinModalLayout.modalMarginTop}`);
  }

  const pinScreenshot = path.join(artifactDir, 'change-pin-fixed.png');
  await page.screenshot({ path: pinScreenshot });
  console.log(`  ✓ Change PIN screenshot captured to: ${pinScreenshot}`);

  // Test functional Change PIN submission
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.fixed.z-50 input[type="password"]'));
    const setVal = (input, val) => {
      const proto = Object.getPrototypeOf(input);
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      nativeSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (inputs.length >= 3) {
      setVal(inputs[0], '1234');
      setVal(inputs[1], '4321');
      setVal(inputs[2], '4321');
    }
  });
  await new Promise((r) => setTimeout(r, 400));

  const formDebug = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.fixed.z-50 input[type="password"]')).map((i) => i.value);
    const btn = Array.from(document.querySelectorAll('.fixed.z-50 button')).find(
      (b) => b.innerText && (b.innerText.includes('পরিবর্তন করুন') || b.innerText.includes('Update PIN') || b.innerText.includes('পরিবর্তন হচ্ছে') || b.innerText.includes('Updating'))
    );
    const alert = document.querySelector('.fixed.z-50 .text-rose-600, .fixed.z-50 .text-emerald-700')?.innerText;
    return {
      inputs,
      btnDisabled: btn?.disabled,
      btnText: btn?.innerText,
      alert,
    };
  });
  console.log('  [Debug] Form before submit:', formDebug);

  await page.evaluate(() => {
    const form = document.querySelector('.fixed.z-50 form');
    if (form) {
      form.requestSubmit();
    } else {
      const submitBtn = Array.from(document.querySelectorAll('.fixed.z-50 button')).find(
        (b) => b.innerText && (b.innerText.includes('পরিবর্তন করুন') || b.innerText.includes('Update PIN'))
      );
      if (submitBtn) submitBtn.click();
    }
  });
  await new Promise((r) => setTimeout(r, 2000));

  const afterDebug = await page.evaluate(() => {
    const alert = document.querySelector('.fixed.z-50 .text-rose-600, .fixed.z-50 .text-emerald-700, .fixed.z-50 .bg-emerald-50, .fixed.z-50 .bg-rose-50')?.innerText;
    return {
      alert,
      bodyTextSnippet: document.body.innerText.slice(0, 300),
    };
  });
  console.log('  [Debug] Form after submit:', afterDebug);

  const pinSuccess = await page.evaluate(() => {
    return document.body.innerText.includes('পিন সফলভাবে পরিবর্তন করা হয়েছে!') || document.body.innerText.includes('PIN changed successfully!');
  });
  console.log(`  ✓ Change PIN end-to-end update succeeded: ${pinSuccess}`);
  if (!pinSuccess) {
    throw new Error('Change PIN submission failed.');
  }

  await browser.close();
  console.log('\n🎉 ALL FIXES VERIFIED SUCCESSFULLY IN BROWSER!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
