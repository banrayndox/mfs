import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const publicDir = path.resolve('client', 'public');

const svgContent = fs.readFileSync(path.join(publicDir, 'brand-icon.svg'), 'utf8');

async function generate() {
  console.log('Launching browser to generate PWA icons...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Helper to render icon
  async function renderIcon(filename, size, isMaskable = false, isApple = false) {
    const padding = isMaskable ? Math.round(size * 0.15) : 0;
    const iconSize = size - padding * 2;
    const bg = isMaskable || isApple ? '#FFD400' : 'transparent';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: ${size}px;
              height: ${size}px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${bg};
              overflow: hidden;
            }
            .icon-wrapper {
              width: ${iconSize}px;
              height: ${iconSize}px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            svg {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <div class="icon-wrapper">
            ${svgContent}
          </div>
        </body>
      </html>
    `;

    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(html);

    const outPath = path.join(publicDir, filename);
    await page.screenshot({
      path: outPath,
      omitBackground: !isMaskable && !isApple,
    });
    console.log(`✓ Generated ${filename} (${size}x${size})`);
  }

  await renderIcon('pwa-192x192.png', 192);
  await renderIcon('pwa-512x512.png', 512);
  await renderIcon('pwa-maskable-192x192.png', 192, true);
  await renderIcon('pwa-maskable-512x512.png', 512, true);
  await renderIcon('apple-touch-icon.png', 180, false, true);
  await renderIcon('favicon.png', 64);

  // Copy favicon.png to favicon.ico as PNG-formatted ICO (supported by all modern browsers)
  fs.copyFileSync(path.join(publicDir, 'favicon.png'), path.join(publicDir, 'favicon.ico'));
  console.log('✓ Generated favicon.ico');

  // Generate mask-icon.svg
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="46" fill="#000000"/>
  <path d="M50 20 L75 32 V52 C75 68 50 80 50 80 C50 80 25 68 25 52 V32 Z" fill="#FFFFFF"/>
  <circle cx="50" cy="46" r="10" fill="#000000"/>
  <path d="M38 64 C38 56 43 53 50 53 C57 53 62 56 62 64 Z" fill="#000000"/>
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'mask-icon.svg'), maskSvg, 'utf8');
  console.log('✓ Generated mask-icon.svg');

  await browser.close();
  console.log('All PWA assets generated successfully in client/public/');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
