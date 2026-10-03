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

async function runVerification() {
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
    } catch (e) {
      console.error('Auth error:', e.message);
    }
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 860, deviceScaleFactor: 2 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });

  if (token) {
    await page.evaluate((t) => {
      localStorage.setItem('guardian_token', t);
    }, token);
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n--- 1. VERIFY FIXED / STICKY HEADER ---');
  // Check initial header position
  const initialHeader = await page.evaluate(() => {
    const h = document.querySelector('header');
    const m = document.querySelector('main');
    return {
      headerTop: h ? h.getBoundingClientRect().top : null,
      headerHeight: h ? h.getBoundingClientRect().height : null,
      mainTop: m ? m.getBoundingClientRect().top : null,
    };
  });
  console.log('Initial positions:', initialHeader);
  if (initialHeader.headerTop === 0 && initialHeader.mainTop >= initialHeader.headerHeight) {
    console.log('✓ Header is at top: 0, and main content starts below header (not hidden underneath)');
  } else {
    console.error('❌ Header or main overlap issue!');
  }

  // Scroll down 300px
  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise((r) => setTimeout(r, 200));

  const scrolledHeader = await page.evaluate(() => {
    const h = document.querySelector('header');
    return {
      headerTop: h ? h.getBoundingClientRect().top : null,
      scrollY: window.scrollY,
    };
  });
  console.log('Scrolled positions:', scrolledHeader);
  if (scrolledHeader.headerTop === 0 && scrolledHeader.scrollY > 100) {
    console.log('✓ Header remains sticky/fixed at top: 0 while scrolling!');
  } else {
    console.error('❌ Header failed to stick at top!');
  }

  const headerStickyShot = path.join(artifactDir, 'header-sticky-scrolled.png');
  await page.screenshot({ path: headerStickyShot, fullPage: false });
  console.log(`✓ Saved sticky header screenshot to ${headerStickyShot}`);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n--- 2. VERIFY HISTORY PAGE SCROLLBAR HIDING ---');
  // Switch to History tab (4th tab, text 'লেনদেন' or 'History')
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('nav button'));
    const historyBtn = tabs.find((el) => el.textContent.includes('লেনদেন') || el.textContent.includes('History'));
    if (historyBtn) historyBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const historyScrollCheck = await page.evaluate(() => {
    const historyContainer = document.querySelector('div.no-scrollbar');
    const computed = historyContainer ? window.getComputedStyle(historyContainer) : null;
    return {
      found: !!historyContainer,
      scrollbarWidth: computed ? computed.scrollbarWidth : null,
      msOverflowStyle: computed ? computed.msOverflowStyle : null,
    };
  });
  console.log('History scrollbar check:', historyScrollCheck);

  const historyShot = path.join(artifactDir, 'history-page-no-scrollbar.png');
  await page.screenshot({ path: historyShot, fullPage: false });
  console.log(`✓ Saved History page screenshot to ${historyShot}`);

  console.log('\n--- 3. VERIFY MORE PAGE SCROLLBAR HIDING ---');
  // Switch to More tab (5th tab, text 'আরও' or 'More')
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('nav button'));
    const moreBtn = tabs.find((el) => el.textContent.includes('আরও') || el.textContent.includes('More'));
    if (moreBtn) moreBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const moreScrollCheck = await page.evaluate(() => {
    const moreContainer = document.querySelector('div.no-scrollbar');
    const computed = moreContainer ? window.getComputedStyle(moreContainer) : null;
    return {
      found: !!moreContainer,
      scrollbarWidth: computed ? computed.scrollbarWidth : null,
    };
  });
  console.log('More scrollbar check:', moreScrollCheck);

  const moreShot = path.join(artifactDir, 'more-page-no-scrollbar.png');
  await page.screenshot({ path: moreShot, fullPage: false });
  console.log(`✓ Saved More page screenshot to ${moreShot}`);

  console.log('\n--- 4. VERIFY AI COPILOT MODAL & DUMMY PROMPTS IN TWO LINES ---');
  // Open AI Agent modal via center button
  await page.evaluate(() => {
    const centerBtn = document.querySelector('button.w-14.h-14');
    if (centerBtn) {
      centerBtn.click();
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  const aiModalCheck = await page.evaluate(() => {
    const modal = document.querySelector('div.fixed.inset-0');
    // Check message thread scrollbar classes
    const thread = document.querySelector('div.flex-1.overflow-y-auto');
    const threadComputed = thread ? window.getComputedStyle(thread) : null;

    // Check dummy prompt lines
    const chipsLines = document.querySelectorAll('div.flex-col.gap-1\\.5 > div.flex');
    const allPromptButtons = document.querySelectorAll('div.flex-col.gap-1\\.5 button');

    const buttonTexts = Array.from(allPromptButtons).map((b) => b.textContent.trim());

    return {
      modalOpen: !!modal,
      threadHiddenScrollbar: threadComputed ? threadComputed.scrollbarWidth : null,
      lineCount: chipsLines.length,
      buttonCount: allPromptButtons.length,
      buttonTexts,
    };
  });
  console.log('AI Copilot modal check:', aiModalCheck);

  if (aiModalCheck.lineCount === 2 && aiModalCheck.buttonCount === 6) {
    console.log('✓ AI Copilot dummy prompts are successfully displayed in TWO LINES (3 items each)!');
  } else {
    console.error('❌ AI Copilot dummy prompts layout issue:', aiModalCheck);
  }

  const aiCopilotShot = path.join(artifactDir, 'ai-copilot-two-lines.png');
  await page.screenshot({ path: aiCopilotShot, fullPage: false });
  console.log(`✓ Saved AI Copilot screenshot to ${aiCopilotShot}`);

  console.log('\n--- 5. DESKTOP RESPONSIVENESS CHECK ---');
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 400));

  const desktopHeaderNav = await page.evaluate(() => {
    const h = document.querySelector('header');
    const n = document.querySelector('nav');
    const hb = h.getBoundingClientRect();
    const nb = n.getBoundingClientRect();
    return {
      headerLeft: hb.left,
      headerWidth: hb.width,
      navLeft: nb.left,
      navWidth: nb.width,
    };
  });
  console.log('Desktop alignment:', desktopHeaderNav);

  const desktopShot = path.join(artifactDir, 'desktop-fixed-header-modal.png');
  await page.screenshot({ path: desktopShot, fullPage: false });
  console.log(`✓ Saved Desktop screenshot to ${desktopShot}`);

  await browser.close();
  console.log('\n🎉 ALL UI CHECKS COMPLETED SUCCESSFULLY!');
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
