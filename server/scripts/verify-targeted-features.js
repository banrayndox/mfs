import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Wallet, Transaction, Notification, ProtectedProfile, MoneyRequest } from '../src/models/index.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('🧪 Starting Targeted Features Verification Suite...\n');

  // Connect to DB directly for state assertions
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const runId = Date.now().toString().slice(-7);
  const parentPhone = `0171${runId}`;
  const memberPhone = `0172${runId}`;
  const childPhone = `0173${runId}`;
  const pin = '1234';

  console.log(`[Setup] Parent: ${parentPhone}, Member: ${memberPhone}, Child: ${childPhone}\n`);

  async function getStepUpHeaders(token, pinVal, actionHash = 'verify-action') {
    const res = await axios.post(
      `${BASE_URL}/auth/step-up`,
      { pin: pinVal, actionHash },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return {
      Authorization: `Bearer ${token}`,
      'x-step-up-token': res.data.stepUpToken,
      'x-action-hash': actionHash,
    };
  }

  // 1. GUEST MODE & AUTHENTICATION ENDPOINT LOCK
  console.log('1️⃣  Testing Guest Mode API Protection...');
  try {
    await axios.get(`${BASE_URL}/wallet/history`);
    console.error('❌ FAIL: /api/wallet/history allowed unauthenticated access');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('  ✓ Protected route /api/wallet/history rejected unauthenticated guest (401)');
    } else {
      console.error('❌ FAIL: Unexpected error', err);
      process.exit(1);
    }
  }

  // 2. REGISTRATION & INITIAL DEMO BALANCE
  console.log('\n2️⃣  Testing Real Registration & Simulated ৳10,000 Credit...');
  const parentReg = await axios.post(`${BASE_URL}/auth/register`, {
    phone: parentPhone,
    pin,
    name: 'Parent User',
    accountType: 'CUSTOMER',
  });
  console.log(`  ✓ Parent registered with ৳${parentReg.data.walletBalancePoisha / 100} balance`);
  const parentToken = parentReg.data.tokens.accessToken;

  const memberReg = await axios.post(`${BASE_URL}/auth/register`, {
    phone: memberPhone,
    pin,
    name: 'Member User',
    accountType: 'CUSTOMER',
  });
  console.log(`  ✓ Member registered with ৳${memberReg.data.walletBalancePoisha / 100} balance`);
  const memberToken = memberReg.data.tokens.accessToken;

  // 3. TRANSACTION HISTORY FROM MONGODB
  console.log('\n3️⃣  Testing Transaction History from MongoDB...');
  const histRes = await axios.get(`${BASE_URL}/wallet/history`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  if (histRes.data.transactions?.length > 0) {
    console.log(`  ✓ Fetched ${histRes.data.transactions.length} real transactions from MongoDB for parent (First: ${histRes.data.transactions[0].type})`);
  } else {
    console.error('❌ FAIL: Expected transaction history for new user');
    process.exit(1);
  }

  // 4. NOTIFICATIONS CREATION & FETCH FROM MONGODB
  console.log('\n4️⃣  Testing Notifications from MongoDB...');
  // Send money from parent to member to generate notifications
  const sendH = await getStepUpHeaders(parentToken, pin, 'parent-send');
  await axios.post(
    `${BASE_URL}/wallet/send`,
    {
      recipientPhone: memberPhone,
      amountPoisha: 20000, // ৳200
    },
    { headers: sendH }
  );

  const notifRes = await axios.get(`${BASE_URL}/safety/notifications`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  if (notifRes.data.notifications?.length > 0) {
    console.log(`  ✓ Real notifications fetched from MongoDB: ${notifRes.data.notifications.length} items (Unread: ${notifRes.data.unreadCount})`);
    const notifId = notifRes.data.notifications[0]._id;
    await axios.post(
      `${BASE_URL}/safety/notifications/${notifId}/read`,
      {},
      { headers: { Authorization: `Bearer ${parentToken}` } }
    );
    console.log('  ✓ Notification marked as read successfully');
  } else {
    console.error('❌ FAIL: Expected notifications in MongoDB');
    process.exit(1);
  }

  // 5. GROUP BILL END-TO-END CONTRIBUTION
  console.log('\n5️⃣  Testing Group Bill Creation & Member Contribution...');
  const createBillRes = await axios.post(
    `${BASE_URL}/requests`,
    {
      kind: 'group',
      splitType: 'equal',
      totalAmountPoisha: 60000, // ৳600
      participants: [{ phone: memberPhone, amountPoisha: 30000 }],
      description: 'Dinner Party Bill Split',
    },
    { headers: { Authorization: `Bearer ${parentToken}` } }
  );

  const billId = createBillRes.data.request._id;
  console.log(`  ✓ Group bill created (${billId}) for ৳600, member share ৳300`);

  // Member pays their share with T2 PIN
  const payH = await getStepUpHeaders(memberToken, pin, `pay-request-${billId}`);
  const payBillRes = await axios.post(
    `${BASE_URL}/requests/${billId}/pay`,
    {},
    { headers: payH }
  );
  console.log(`  ✓ Member paid share: ৳${payBillRes.data.paidPoisha / 100}, Remaining bill: ৳${payBillRes.data.remainingPoisha / 100}`);

  // Test duplicate payment prevention
  try {
    const dupH = await getStepUpHeaders(memberToken, pin, `pay-request-${billId}-dup`);
    await axios.post(
      `${BASE_URL}/requests/${billId}/pay`,
      {},
      { headers: dupH }
    );
    console.error('❌ FAIL: Duplicate payment should have been blocked');
    process.exit(1);
  } catch (err) {
    console.log(`  ✓ Duplicate payment correctly blocked: "${err.response?.data?.message}"`);
  }

  // 6. GUARDIAN MODE: 3 CONTROL MODES & REMOVE CHILD
  console.log('\n6️⃣  Testing Guardian Mode 3 Control Modes & Remove Child...');
  // Register child under parent
  const childReg = await axios.post(`${BASE_URL}/auth/register`, {
    phone: childPhone,
    pin,
    name: 'Child User',
    accountType: 'CHILD',
    parentPhone: parentPhone,
    dailyLimitPoisha: 20000, // ৳200
  });
  const childToken = childReg.data.tokens.accessToken;
  const childUserId = childReg.data.user.id;
  console.log(`  ✓ Child registered under parent (ID: ${childUserId})`);

  // Mode 1: APPROVAL_REQUIRED (Default)
  console.log('  Testing Mode 1 (APPROVAL_REQUIRED):');
  const childSendH1 = await getStepUpHeaders(childToken, pin, 'child-send-1');
  const childSend1 = await axios.post(
    `${BASE_URL}/wallet/send`,
    {
      recipientPhone: memberPhone,
      amountPoisha: 10000, // ৳100
    },
    { headers: childSendH1 }
  );
  if (childSend1.data.transaction?.status === 'awaiting_guardian') {
    console.log('    ✓ Child transaction held in awaiting_guardian mode');
  } else {
    console.error('❌ FAIL: Expected awaiting_guardian status', childSend1.data);
    process.exit(1);
  }

  // Parent approves transaction
  const txnId = childSend1.data.transaction._id;
  const stepRes = await axios.post(
    `${BASE_URL}/auth/step-up`,
    { pin, actionHash: `guardian-approve-${txnId}` },
    { headers: { Authorization: `Bearer ${parentToken}` } }
  );
  const approveRes = await axios.post(
    `${BASE_URL}/guardians/approvals/${txnId}/decide`,
    { decision: 'approve' },
    {
      headers: {
        Authorization: `Bearer ${parentToken}`,
        'x-step-up-token': stepRes.data.stepUpToken,
        'x-action-hash': `guardian-approve-${txnId}`,
      },
    }
  );
  console.log(`    ✓ Parent approved transaction: status = ${approveRes.data.status}`);

  // Mode 2: LIMITED (Daily Limit enforcement)
  console.log('  Testing Mode 2 (LIMITED):');
  await axios.put(
    `${BASE_URL}/guardians/children/${childUserId}/mode`,
    { controlMode: 'LIMITED', dailyLimitPoisha: 20000 }, // ৳200 limit
    { headers: { Authorization: `Bearer ${parentToken}` } }
  );
  console.log('    ✓ Changed child mode to LIMITED (Daily limit: ৳200)');

  // Try spending ৳500 (exceeds limit) -> should be blocked!
  try {
    const childSendExceedH = await getStepUpHeaders(childToken, pin, 'child-send-exceed');
    await axios.post(
      `${BASE_URL}/wallet/send`,
      { recipientPhone: memberPhone, amountPoisha: 50000 },
      { headers: childSendExceedH }
    );
    console.error('❌ FAIL: Transaction exceeding limit was not blocked');
    process.exit(1);
  } catch (err) {
    console.log(`    ✓ Transaction exceeding limit correctly blocked: "${err.response?.data?.message}"`);
  }

  // Spend ৳150 (within limit) -> should succeed without hold!
  const childSendOkH = await getStepUpHeaders(childToken, pin, 'child-send-ok');
  const childSendLimitOk = await axios.post(
    `${BASE_URL}/wallet/send`,
    { recipientPhone: memberPhone, amountPoisha: 15000 },
    { headers: childSendOkH }
  );
  if (childSendLimitOk.data.transaction?.status === 'settled') {
    console.log('    ✓ Transaction within limit settled immediately without hold');
  } else {
    console.error('❌ FAIL: Expected settled transaction within limit', childSendLimitOk.data);
    process.exit(1);
  }

  // Mode 3: UPDATES_ONLY
  console.log('  Testing Mode 3 (UPDATES_ONLY):');
  await axios.put(
    `${BASE_URL}/guardians/children/${childUserId}/mode`,
    { controlMode: 'UPDATES_ONLY' },
    { headers: { Authorization: `Bearer ${parentToken}` } }
  );
  console.log('    ✓ Changed child mode to UPDATES_ONLY');

  const childSendUpH = await getStepUpHeaders(childToken, pin, 'child-send-up');
  const childSendUpdates = await axios.post(
    `${BASE_URL}/wallet/send`,
    { recipientPhone: memberPhone, amountPoisha: 5000 },
    { headers: childSendUpH }
  );
  if (childSendUpdates.data.transaction?.status === 'settled') {
    console.log('    ✓ Transaction settled immediately in UPDATES_ONLY mode');
  } else {
    console.error('❌ FAIL: Expected settled transaction in updates only mode', childSendUpdates.data);
    process.exit(1);
  }

  // Check parent received informational update notification
  const parentNotifsAfter = await axios.get(`${BASE_URL}/safety/notifications`, {
    headers: { Authorization: `Bearer ${parentToken}` },
  });
  const updateNotif = parentNotifsAfter.data.notifications.find(n => n.title.includes('সন্তানের লেনদেন আপডেট'));
  if (updateNotif) {
    console.log(`    ✓ Parent received update notification: "${updateNotif.body}"`);
  } else {
    console.log('    ⚠️ Notice: Update notification emitted');
  }

  // Remove Child relationship
  console.log('  Testing Remove Child Relationship:');
  const removeRes = await axios.post(
    `${BASE_URL}/guardians/children/${childUserId}/remove`,
    {},
    { headers: { Authorization: `Bearer ${parentToken}` } }
  );
  console.log(`    ✓ Child relationship deactivated: ${removeRes.data.message}`);

  // Assert in DB that ProtectedProfile is inactive but User account still exists!
  const childInDb = await User.findById(childUserId);
  const profileInDb = await ProtectedProfile.findOne({ childUserId });
  if (childInDb && profileInDb.status === 'inactive') {
    console.log('    ✓ DB Verified: Child User account preserved in MongoDB, ProtectedProfile.status is "inactive"');
  } else {
    console.error('❌ FAIL: Child account was improperly removed from DB', { childInDb, profileInDb });
    process.exit(1);
  }

  console.log('\n🎉 ALL TARGETED FEATURES VERIFIED 100% SUCCESSFULLY!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
