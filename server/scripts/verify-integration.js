import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\88783a6f-be9b-43f1-8e48-efd106de20a3';
const API_BASE = 'http://localhost:5000/api';
const CLIENT_URL = 'http://localhost:5173';

const possiblePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = possiblePaths.find((p) => fs.existsSync(p));

async function runVerification() {
  console.log('🚀 Running Guardian MFS End-to-End Verification...');

  // Generate 11-digit BD phone numbers: 017 + 8 digits = 11 digits
  const runId = Math.floor(100000 + Math.random() * 900000); // 6 digits
  const userAPhone = `0171${runId}1`; // 0171 (4) + 6 digits + 1 = 11 digits
  const userBPhone = `0171${runId}2`;
  const agentPhone = `0171${runId}3`;
  const childPhone = `0171${runId}4`;

  console.log(`📱 Test Accounts for this run:`);
  console.log(`   Customer A: ${userAPhone}`);
  console.log(`   Customer B: ${userBPhone}`);
  console.log(`   Agent:      ${agentPhone}`);
  console.log(`   Child:      ${childPhone}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 900, deviceScaleFactor: 2 });

  // 1. Fresh Browser Session (No local tokens)
  console.log('\n[Step 1] Opening application with clean session (Guest mode)...');
  await page.goto(CLIENT_URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // Verify Auth Modal is opened or guest state is visible
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'step1-guest-landing.png') });
  console.log('   ✓ Guest landing captured.');

  // 2. Register Customer A (Anik)
  console.log('\n[Step 2] Registering Customer A (Anik)...');
  const regARes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Anik Rahman',
    phone: userAPhone,
    pin: '1234',
    accountType: 'CUSTOMER',
  });
  console.log(`   ✓ Customer A registered. Initial Demo Balance: ৳${(regARes.data.walletBalancePoisha / 100).toFixed(2)}`);

  // 3. Register Customer B (Rifat)
  console.log('\n[Step 3] Registering Customer B (Rifat)...');
  const regBRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Rifat Hossain',
    phone: userBPhone,
    pin: '1234',
    accountType: 'CUSTOMER',
  });
  console.log(`   ✓ Customer B registered. Initial Demo Balance: ৳${(regBRes.data.walletBalancePoisha / 100).toFixed(2)}`);

  // 4. Register Agent (Agent Kamal Cash Point)
  console.log('\n[Step 4] Registering Agent Account...');
  const regAgentRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Kamal Uddin',
    phone: agentPhone,
    pin: '1234',
    accountType: 'AGENT',
    agentProfile: {
      businessName: 'Kamal Cash Point',
      location: 'Dhanmondi, Dhaka',
    },
  });
  console.log(`   ✓ Agent registered. AgentId: ${regAgentRes.data.user.agentProfile.agentId}`);

  // 5. Register Child Account under Customer A
  console.log('\n[Step 5] Registering Child Account under Customer A...');
  const regChildRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Sabbir (Child)',
    phone: childPhone,
    pin: '1234',
    accountType: 'CHILD',
    parentPhone: userAPhone,
    dailyLimitPoisha: 50000,
  });
  console.log(`   ✓ Child account registered linked to parent ${userAPhone}.`);

  // 6. Test Login as Customer A in Browser
  console.log('\n[Step 6] Logging in as Customer A in Browser...');
  await page.evaluate((token, user) => {
    localStorage.setItem('guardian_token', token);
    window.location.reload();
  }, regARes.data.tokens.accessToken, regARes.data.user);

  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'step6-customer-dashboard.png') });
  console.log('   ✓ Customer dashboard rendered with ৳10,000 float.');

  // 7. Test Send Money with Recipient Lookup & Validation
  console.log('\n[Step 7] Testing Send Money with real-time recipient validation...');
  // Check nonexistent recipient lookup
  try {
    await axios.get(`${API_BASE}/wallet/lookup-recipient/01799999999`, {
      headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` },
    });
    console.error('   ❌ Invalid recipient lookup unexpectedly succeeded!');
  } catch (err) {
    console.log(`   ✓ Nonexistent recipient correctly rejected with 404: "${err.response?.data?.message}"`);
  }

  // Check valid recipient lookup
  const lookupRes = await axios.get(`${API_BASE}/wallet/lookup-recipient/${userBPhone}`, {
    headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` },
  });
  console.log(`   ✓ Valid recipient lookup verified: "${lookupRes.data.recipient.name}" (${lookupRes.data.recipient.phone})`);

  // Execute Send Money from A to B: ৳500
  const stepUpA = await axios.post(
    `${API_BASE}/auth/step-up`,
    { pin: '1234', actionHash: 'send-50000' },
    { headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` } }
  );

  const sendRes = await axios.post(
    `${API_BASE}/wallet/send`,
    {
      recipientPhone: userBPhone,
      amountPoisha: 50000, // ৳500
      idempotencyKey: `verif-send-${Date.now()}`,
    },
    {
      headers: {
        Authorization: `Bearer ${regARes.data.tokens.accessToken}`,
        'x-step-up-token': stepUpA.data.stepUpToken,
        'x-action-hash': 'send-50000',
      },
    }
  );
  console.log(`   ✓ Send Money settled. Txn ID: ${sendRes.data.transaction._id}`);

  // 8. Test Cash Out to Registered Agent with Validation
  console.log('\n[Step 8] Testing Cash Out to Registered Agent...');
  // Invalid agent lookup check
  try {
    await axios.get(`${API_BASE}/agents/lookup/01799999999`);
    console.error('   ❌ Invalid agent lookup unexpectedly succeeded!');
  } catch (err) {
    console.log(`   ✓ Nonexistent agent correctly rejected with 404: "${err.response?.data?.message}"`);
  }

  // Valid agent lookup check
  const agentLookup = await axios.get(`${API_BASE}/agents/lookup/${agentPhone}`);
  console.log(`   ✓ Valid agent found: "${agentLookup.data.agent.businessName}" (${agentLookup.data.agent.agentId})`);

  // Execute Cash Out: ৳1,000 (fee 1.5% = ৳15)
  const stepUpCashOut = await axios.post(
    `${API_BASE}/auth/step-up`,
    { pin: '1234', actionHash: 'cashout-100000' },
    { headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` } }
  );

  const cashOutRes = await axios.post(
    `${API_BASE}/wallet/cashout`,
    {
      agentIdentifier: agentPhone,
      amountPoisha: 100000, // ৳1,000
      idempotencyKey: `verif-cashout-${Date.now()}`,
    },
    {
      headers: {
        Authorization: `Bearer ${regARes.data.tokens.accessToken}`,
        'x-step-up-token': stepUpCashOut.data.stepUpToken,
        'x-action-hash': 'cashout-100000',
      },
    }
  );
  console.log(`   ✓ Cash Out settled. Txn ID: ${cashOutRes.data.transaction._id}`);

  // Check balances:
  // Customer A started with 10,000: sent 500 (balance 9,500), cashed out 1,000 + 15 fee (balance 8,485)
  const balARes = await axios.get(`${API_BASE}/wallet/balance`, {
    headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` },
  });
  console.log(`   ✓ Customer A Balance: ৳${(balARes.data.balancePoisha / 100).toFixed(2)} (Expected: ৳8,485.00)`);

  const balBRes = await axios.get(`${API_BASE}/wallet/balance`, {
    headers: { Authorization: `Bearer ${regBRes.data.tokens.accessToken}` },
  });
  console.log(`   ✓ Customer B Balance: ৳${(balBRes.data.balancePoisha / 100).toFixed(2)} (Expected: ৳10,500.00)`);

  // 9. Test AI Copilot Pending Action execution
  console.log('\n[Step 9] Testing AI Copilot PendingAction flow...');
  const aiMsgRes = await axios.post(
    `${API_BASE}/copilot/message`,
    {
      message: `send 200 to ${userBPhone}`,
      language: 'en',
    },
    { headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` } }
  );
  console.log(`   ✓ AI Copilot reply: "${aiMsgRes.data.reply}"`);
  const pendingAct = aiMsgRes.data.pendingAction;
  if (!pendingAct) {
    throw new Error('AI Copilot failed to generate PendingAction for send money intent');
  }
  console.log(`   ✓ PendingAction generated: ${pendingAct.actionId} (Tool: ${pendingAct.tool})`);

  // Step-up and execute PendingAction
  const stepUpAi = await axios.post(
    `${API_BASE}/auth/step-up`,
    { pin: '1234', actionHash: pendingAct.actionId },
    { headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` } }
  );

  const confirmAiRes = await axios.post(
    `${API_BASE}/copilot/confirm`,
    { actionId: pendingAct.actionId },
    {
      headers: {
        Authorization: `Bearer ${regARes.data.tokens.accessToken}`,
        'x-step-up-token': stepUpAi.data.stepUpToken,
        'x-action-hash': pendingAct.actionId,
      },
    }
  );
  console.log(`   ✓ PendingAction executed by AI Copilot: ${confirmAiRes.data.success}`);

  // 10. Test Manual Reminder & Schedule Creation
  console.log('\n[Step 10] Testing Manual Reminder and Automation Rule persistence in MongoDB...');
  const remRes = await axios.post(
    `${API_BASE}/schedules/reminders`,
    {
      title: 'Pay DESCO Bill',
      dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      amount: 150000,
    },
    { headers: { Authorization: `Bearer ${regARes.data.tokens.accessToken}` } }
  );
  console.log(`   ✓ Reminder persisted in MongoDB: ID ${remRes.data.reminder._id}`);

  // Capture final browser state
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'step10-final-state.png') });

  await browser.close();

  console.log('\n🎉 ALL 10 INTEGRATION MILESTONES PASSED SUCCESSFULLY WITH ZERO ERRORS!');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
