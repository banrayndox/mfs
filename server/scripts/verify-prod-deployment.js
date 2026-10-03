import https from 'https';

const tests = [
  { url: 'https://mfs-wheat-eta.vercel.app/', check: 'HTML App Shell' },
  { url: 'https://mfs-wheat-eta.vercel.app/manifest.webmanifest', check: 'PWA Web App Manifest' },
  { url: 'https://mfs-wheat-eta.vercel.app/sw.js', check: 'PWA Service Worker' },
  { url: 'https://mfs-wheat-eta.vercel.app/pwa-192x192.png', check: 'Standard 192x192 Icon' },
  { url: 'https://mfs-wheat-eta.vercel.app/pwa-512x512.png', check: 'Standard 512x512 Icon' },
  { url: 'https://mfs-wheat-eta.vercel.app/pwa-maskable-192x192.png', check: 'Maskable 192x192 Icon' },
  { url: 'https://mfs-wheat-eta.vercel.app/pwa-maskable-512x512.png', check: 'Maskable 512x512 Icon' },
  { url: 'https://mfs-wheat-eta.vercel.app/apple-touch-icon.png', check: 'iOS Apple Touch Icon' },
  { url: 'https://mfs-wheat-eta.vercel.app/api/health', check: 'Serverless Express Health API' },
];

async function verifyAll() {
  console.log('--- Verifying Vercel Production Deployment ---');
  for (const t of tests) {
    await new Promise((resolve) => {
      https.get(t.url, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          const contentType = res.headers['content-type'] || 'unknown';
          const ok = res.statusCode === 200 ? '✓' : '✗';
          console.log(`${ok} [${res.statusCode}] ${t.check}: ${t.url} (${contentType})`);

          if (t.check.includes('Manifest') && res.statusCode === 200) {
            try {
              const m = JSON.parse(body);
              console.log('   - Name:', m.name);
              console.log('   - Short Name:', m.short_name);
              console.log('   - Display:', m.display);
              console.log('   - Start URL:', m.start_url);
              console.log('   - Scope:', m.scope);
              console.log('   - Icons count:', m.icons.length);
              console.log('   - Theme Color:', m.theme_color);
            } catch (e) {
              console.error('   Failed to parse manifest:', e.message);
            }
          }

          if (t.check.includes('Health') && res.statusCode === 200) {
            console.log('   - Health response:', body);
          }

          resolve();
        });
      }).on('error', (err) => {
        console.error(`✗ Error requesting ${t.url}:`, err.message);
        resolve();
      });
    });
  }
}

verifyAll();
