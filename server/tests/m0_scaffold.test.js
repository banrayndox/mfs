import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('M0: Scaffold & Foundation', () => {
  it('should serve /api/health with status ok and mock mode when GROQ_API_KEY is not set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.ai).toBeDefined();
    expect(res.body.ai.mockMode).toBe(true);
  });

  it('should maintain 100% key parity between English and Bangla locales', () => {
    const enPath = path.join(rootDir, 'client/src/locales/en.json');
    const bnPath = path.join(rootDir, 'client/src/locales/bn.json');

    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(bnPath)).toBe(true);

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const bn = JSON.parse(fs.readFileSync(bnPath, 'utf8'));

    function getKeys(obj, prefix = '') {
      return Object.keys(obj).flatMap((key) => {
        const val = obj[key];
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        return typeof val === 'object' && val !== null ? getKeys(val, newPrefix) : newPrefix;
      });
    }

    const enKeys = getKeys(en).sort();
    const bnKeys = getKeys(bn).sort();

    const missingInBn = enKeys.filter((k) => !bnKeys.includes(k));
    const missingInEn = bnKeys.filter((k) => !enKeys.includes(k));

    expect(missingInBn, `Keys missing in bn.json: ${missingInBn.join(', ')}`).toEqual([]);
    expect(missingInEn, `Keys missing in en.json: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('should have generated valid JWT and VAPID secrets in .env', () => {
    const envPath = path.join(rootDir, '.env');
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf8');

    expect(content).toMatch(/JWT_ACCESS_SECRET=[a-f0-9]{32,}/);
    expect(content).toMatch(/JWT_REFRESH_SECRET=[a-f0-9]{32,}/);
    expect(content).toMatch(/VAPID_PUBLIC_KEY=.+/);
    expect(content).toMatch(/VAPID_PRIVATE_KEY=.+/);
  });
});
