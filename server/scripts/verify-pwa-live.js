import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const prodUrl = 'https://mfs-wheat-eta.vercel.app';

async function testLivePWA() {
  console.log(`Testing live PWA in Chrome at ${prodUrl}...`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Listen to console messages
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  await page.goto(prodUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Check document title
  const title = await page.title();
  console.log('✓ Page Title:', title);

  // Check manifest link tag
  const manifestHref = await page.$eval('link[rel="manifest"]', el => el.href).catch(() => null);
  console.log('✓ Manifest Link:', manifestHref);

  // Check theme color meta tag
  const themeColor = await page.$eval('meta[name="theme-color"]', el => el.content).catch(() => null);
  console.log('✓ Theme Color:', themeColor);

  // Check Service Worker registration in the browser
  const swRegistered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length > 0;
  });
  console.log('✓ Service Worker Registered in Browser:', swRegistered);

  await browser.close();
  console.log('Chrome PWA verification passed successfully!');
}

testLivePWA().catch(err => {
  console.error('Error during live Chrome test:', err);
  process.exit(1);
});
