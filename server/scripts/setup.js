import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const envExamplePath = path.join(rootDir, '.env.example');
const envPath = path.join(rootDir, '.env');

console.log('🛡️  Running Guardian MFS Setup...\n');

let envContent = '';
if (fs.existsSync(envPath)) {
  console.log('✓ Found existing .env file.');
  envContent = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync(envExamplePath)) {
  console.log('✓ Creating .env from .env.example...');
  envContent = fs.readFileSync(envExamplePath, 'utf8');
} else {
  console.error('❌ Neither .env nor .env.example found!');
  process.exit(1);
}

// Generate secrets if missing or empty
let modified = false;

function setEnvValue(key, generator) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const match = envContent.match(regex);
  if (!match || match[0].trim() === `${key}=`) {
    const newVal = generator();
    if (match) {
      envContent = envContent.replace(regex, `${key}=${newVal}`);
    } else {
      envContent += `\n${key}=${newVal}`;
    }
    console.log(`✓ Generated ${key}`);
    modified = true;
  } else {
    console.log(`✓ ${key} already configured.`);
  }
}

setEnvValue('JWT_ACCESS_SECRET', () => crypto.randomBytes(32).toString('hex'));
setEnvValue('JWT_REFRESH_SECRET', () => crypto.randomBytes(32).toString('hex'));

// Generate VAPID keys
let hasVapidPublic = /^VAPID_PUBLIC_KEY=.+$/m.test(envContent);
let hasVapidPrivate = /^VAPID_PRIVATE_KEY=.+$/m.test(envContent);

if (!hasVapidPublic || !hasVapidPrivate) {
  try {
    // Attempt dynamic import of web-push if installed
    const webpush = await import('web-push');
    const vapidKeys = webpush.default.generateVAPIDKeys();
    setEnvValue('VAPID_PUBLIC_KEY', () => vapidKeys.publicKey);
    setEnvValue('VAPID_PRIVATE_KEY', () => vapidKeys.privateKey);
  } catch {
    // Fallback: Generate valid URL-safe base64 keys using crypto secp256r1
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const pubKey = ecdh.getPublicKey('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const privKey = ecdh.getPrivateKey('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    setEnvValue('VAPID_PUBLIC_KEY', () => pubKey);
    setEnvValue('VAPID_PRIVATE_KEY', () => privKey);
  }
}

if (modified || !fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log('✓ Successfully wrote .env configuration.');
}

console.log('\n======================================================');
console.log('✅ Guardian MFS Setup Completed Successfully!');
console.log('👉 Next Steps:');
console.log('   1. Optional: Add GROQ_API_KEY and MONGODB_URI in .env');
console.log('      (If blank, in-memory DB and mock LLM mode will run automatically)');
console.log('   2. Run: npm run doctor (to check environment and models)');
console.log('   3. Run: npm run dev    (to start client and server concurrently)');
console.log('======================================================\n');
