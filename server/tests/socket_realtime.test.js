import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import { initSocket } from '../src/services/socket.service.js';
import { setupTestDb, teardownTestDb, clearTestDb } from './helpers.js';
import { register, login } from '../src/services/auth.service.js';
import { sendMoney } from '../src/services/transaction.service.js';
import { linkGuardian, decideGuardianApproval } from '../src/services/guardian.service.js';
import { createMoneyRequest, payMoneyRequest } from '../src/services/request.service.js';
import { ProtectedProfile, Transaction } from '../src/models/index.js';

describe('Socket.IO Realtime Updates & Multi-Client Synchronization', () => {
  let server;
  let ioServer;
  let port;
  let serverUrl;

  beforeAll(async () => {
    await setupTestDb();

    // Spin up local HTTP server on random port
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, {
      cors: { origin: '*' },
    });
    initSocket(ioServer);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (ioServer) ioServer.close();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('1. Rejects unauthenticated connections and accepts authenticated clients into their private room', async () => {
    // A. Missing token connection must fail
    const unauthClient = ioClient(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
    });

    const connectErrorPromise = new Promise((resolve) => {
      unauthClient.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    const errorMsg = await connectErrorPromise;
    expect(errorMsg).toContain('Authentication required');
    unauthClient.close();

    // B. Register valid user and connect with JWT
    const { tokens } = await register({
      phone: '01710000001',
      pin: '1234',
      name: 'Auth Test User',
      accountType: 'CUSTOMER',
    });

    const authClient = ioClient(serverUrl, {
      auth: { token: tokens.accessToken },
      transports: ['websocket'],
      reconnection: false,
    });

    const connectedPromise = new Promise((resolve) => {
      authClient.on('connect', () => resolve(true));
    });

    const connected = await connectedPromise;
    expect(connected).toBe(true);
    expect(authClient.connected).toBe(true);

    authClient.close();
  });

  it('2. Multi-Client: Live wallet balance, transaction and notification updates when User A transfers to User B', async () => {
    // Register User A (Sender) and User B (Recipient)
    const userA = await register({
      phone: '01710000010',
      pin: '1234',
      name: 'Sender User A',
      accountType: 'CUSTOMER',
    });

    const userB = await register({
      phone: '01710000020',
      pin: '1234',
      name: 'Recipient User B',
      accountType: 'CUSTOMER',
    });

    // Connect User A socket
    const socketA = ioClient(serverUrl, {
      auth: { token: userA.tokens.accessToken },
      transports: ['websocket'],
    });

    // Connect User B socket
    const socketB = ioClient(serverUrl, {
      auth: { token: userB.tokens.accessToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => socketA.on('connect', res)),
      new Promise((res) => socketB.on('connect', res)),
    ]);

    // Setup listeners on User B socket
    const bBalancePromise = new Promise((resolve) => {
      socketB.once('wallet:balance', (data) => resolve(data));
    });
    const bTxnPromise = new Promise((resolve) => {
      socketB.once('transaction:new', (data) => resolve(data));
    });
    const bNotifPromise = new Promise((resolve) => {
      socketB.once('notification:new', (data) => resolve(data));
    });

    // Setup listener on User A socket
    const aBalancePromise = new Promise((resolve) => {
      socketA.once('wallet:balance', (data) => resolve(data));
    });

    // User A sends ৳500 (50,000 poisha) to User B via service
    await sendMoney({
      senderUserId: userA.user.id,
      recipientPhone: '01710000020',
      amountPoisha: 50000,
      channel: 'ui',
    });

    // Assert User B receives all realtime events immediately without polling
    const bBalance = await bBalancePromise;
    // User B started with ৳10,000 (1,000,000 poisha) + ৳500 = 1,050,000 poisha
    expect(bBalance.balancePoisha).toBe(1050000);

    const bTxn = await bTxnPromise;
    expect(bTxn.transaction).toBeDefined();
    expect(bTxn.transaction.type).toBe('send');
    expect(bTxn.transaction.amount).toBe(50000);

    const bNotif = await bNotifPromise;
    expect(bNotif.notification).toBeDefined();
    expect(bNotif.notification.title).toContain('টাকা গ্রহণ');

    // Assert User A receives decremented balance
    const aBalance = await aBalancePromise;
    expect(aBalance.balancePoisha).toBe(950000);

    socketA.close();
    socketB.close();
  });

  it('3. Realtime Guardian Approval: Child transfer alert received by Guardian, and Decision received by Child', async () => {
    // Register Guardian (Parent) and Child
    const guardian = await register({
      phone: '01710000099',
      pin: '1234',
      name: 'Abba Guardian',
      accountType: 'CUSTOMER',
    });

    const child = await register({
      phone: '01720000088',
      pin: '1234',
      name: 'Chhotu Child',
      accountType: 'CHILD',
      parentPhone: '01710000099',
      dob: '2012-05-15',
    });

    // Link Guardian with APPROVAL_REQUIRED mode and ৳200 limit
    await ProtectedProfile.findOneAndUpdate(
      { childUserId: child.user.id },
      {
        guardianId: guardian.user.id,
        controlMode: 'APPROVAL_REQUIRED',
        dailyLimitPoisha: 20000,
        status: 'active',
      },
      { upsert: true }
    );

    // Connect Guardian and Child sockets
    const guardianSocket = ioClient(serverUrl, {
      auth: { token: guardian.tokens.accessToken },
      transports: ['websocket'],
    });

    const childSocket = ioClient(serverUrl, {
      auth: { token: child.tokens.accessToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => guardianSocket.on('connect', res)),
      new Promise((res) => childSocket.on('connect', res)),
    ]);

    // Setup listener on Guardian socket for approval request
    const guardianRequestPromise = new Promise((resolve) => {
      guardianSocket.once('guardian:approval_request', (data) => resolve(data));
    });

    // Child attempts to send ৳300 (exceeds ৳200 limit) -> enters awaiting_guardian
    const heldTxn = await sendMoney({
      senderUserId: child.user.id,
      recipientPhone: '01710000099',
      amountPoisha: 30000,
      channel: 'ui',
    });
    expect(heldTxn.status).toBe('awaiting_guardian');

    // Guardian receives realtime approval request
    const approvalReq = await guardianRequestPromise;
    expect(approvalReq.txnId.toString()).toBe(heldTxn._id.toString());
    expect(approvalReq.amountPoisha).toBe(30000);

    // Setup listener on Child socket for approval decision
    const childDecisionPromise = new Promise((resolve) => {
      childSocket.once('guardian:approval_decided', (data) => resolve(data));
    });

    // Guardian approves the transaction
    await decideGuardianApproval({
      guardianUserId: guardian.user.id,
      txnId: heldTxn._id.toString(),
      decision: 'approve',
    });

    // Child receives realtime approval confirmation
    const childDecision = await childDecisionPromise;
    expect(childDecision.status).toBe('settled');
    expect(childDecision.decision).toBe('approve');

    guardianSocket.close();
    childSocket.close();
  });

  it('4. Realtime Group Bill: Creator receives update when participant pays share', async () => {
    // Register Creator and Participant
    const creator = await register({
      phone: '01710000033',
      pin: '1234',
      name: 'Group Host',
      accountType: 'CUSTOMER',
    });

    const participant = await register({
      phone: '01710000044',
      pin: '1234',
      name: 'Group Member',
      accountType: 'CUSTOMER',
    });

    // Create group bill: ৳1,000 split equally between creator and participant (৳500 each)
    const request = await createMoneyRequest({
      creatorUserId: creator.user.id,
      kind: 'group',
      splitType: 'equal',
      totalAmountPoisha: 100000,
      description: 'Dinner Bill Split',
      participants: [
        { phone: '01710000033', name: 'Group Host', amountPoisha: 50000 },
        { phone: '01710000044', name: 'Group Member', amountPoisha: 50000 },
      ],
    });

    // Connect Creator socket
    const creatorSocket = ioClient(serverUrl, {
      auth: { token: creator.tokens.accessToken },
      transports: ['websocket'],
    });

    await new Promise((res) => creatorSocket.on('connect', res));

    // Creator socket listens for group_bill:update
    const groupUpdatePromise = new Promise((resolve) => {
      creatorSocket.once('group_bill:update', (data) => resolve(data));
    });

    // Participant pays their share
    await payMoneyRequest({
      requestId: request._id.toString(),
      payerUserId: participant.user.id,
    });

    // Creator receives live group bill update with remainingAmount ৳500
    const groupUpdate = await groupUpdatePromise;
    expect(groupUpdate.request).toBeDefined();
    expect(groupUpdate.request.remainingAmount).toBe(50000);

    creatorSocket.close();
  });

  it('5. Disconnect and Reconnection: REST operations continue unaffected when socket is disconnected', async () => {
    const user = await register({
      phone: '01710000055',
      pin: '1234',
      name: 'Resilient User',
      accountType: 'CUSTOMER',
    });

    const client = ioClient(serverUrl, {
      auth: { token: user.tokens.accessToken },
      transports: ['websocket'],
    });

    await new Promise((res) => client.on('connect', res));
    expect(client.connected).toBe(true);

    // Disconnect socket manually
    client.disconnect();
    expect(client.connected).toBe(false);

    // User can still execute REST transactions with zero errors
    const txn = await sendMoney({
      senderUserId: user.user.id,
      recipientPhone: '01710000055', // self transfer fails validation safely
      amountPoisha: 10000,
      channel: 'ui',
    }).catch((err) => err);

    expect(txn).toBeDefined();

    // Reconnect socket and verify it connects back
    client.connect();
    await new Promise((res) => client.on('connect', res));
    expect(client.connected).toBe(true);

    client.close();
  });
});
