# Guardian MFS — Backend API Documentation

All monetary amounts are represented as **integer minor units (poisha)**: `100 poisha = ৳1.00`.
Protected endpoints require `Authorization: Bearer <accessToken>`.
Financial mutations (T2/T3) require `x-step-up-token: <token>` and `x-action-hash: <hash>`.

---

## 1. Authentication & Identity

### `POST /api/auth/register`
Creates a new Customer or Agent account and atomically credits **৳10,000 demo balance** (1,000,000 poisha) with an auditable ledger entry.
- **Request Body**:
  ```json
  {
    "phone": "01711112222",
    "pin": "1234",
    "name": "Rakib",
    "accountType": "CUSTOMER",
    "agentProfile": {
      "businessName": "Rakib Store",
      "location": "Dhaka"
    }
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": {
      "id": "6ab...",
      "phone": "01711112222",
      "name": "Rakib",
      "accountType": "CUSTOMER",
      "agentProfile": null
    },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    },
    "walletBalancePoisha": 1000000
  }
  ```

### `POST /api/auth/login`
Authenticates a user with phone and 4-digit PIN. Implements rate limiting and lockout after 3 consecutive failures for 15 minutes.
- **Request Body**:
  ```json
  {
    "phone": "01711112222",
    "pin": "1234"
  }
  ```

### `POST /api/auth/step-up`
Generates a short-lived (60s TTL) `stepUpToken` bound to an `actionHash` upon verifying the user's PIN.
- **Request Body**:
  ```json
  {
    "pin": "1234",
    "actionHash": "send-50000"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "stepUpToken": "jwt..."
  }
  ```

### `GET /api/auth/me`
Retrieves current user identity, limits, and primary wallet balance.

---

## 2. Financial Wallet & Ledger Operations

### `GET /api/wallet/lookup-recipient/:phone`
Validates whether a recipient mobile number exists in MongoDB prior to PIN confirmation.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "recipient": {
      "name": "Rifat Hossain",
      "phone": "01711221302",
      "accountType": "CUSTOMER"
    }
  }
  ```
- **Response `404 Not Found`**:
  ```json
  {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Invalid account / Account not found in Guardian MFS."
  }
  ```

### `POST /api/wallet/send`
Transfers money peer-to-peer between customer wallets.
- **Headers**:
  - `x-step-up-token`: `<token>`
  - `x-action-hash`: `send-<amountPoisha>`
- **Request Body**:
  ```json
  {
    "recipientPhone": "01733334444",
    "amountPoisha": 50000,
    "note": "Dinner bill",
    "idempotencyKey": "req-send-12345"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "transaction": {
      "_id": "6ab...",
      "type": "send",
      "amount": 50000,
      "fee": 0,
      "status": "completed",
      "idempotencyKey": "req-send-12345"
    }
  }
  ```

### `POST /api/wallet/cashout`
Withdraws money to an authorized Agent point with a 1.5% fee.
- **Headers**:
  - `x-step-up-token`: `<token>`
  - `x-action-hash`: `cashout-<amountPoisha>`
- **Request Body**:
  ```json
  {
    "agentIdentifier": "AGT-6666-335",
    "amountPoisha": 100000,
    "idempotencyKey": "req-cashout-12345"
  }
  ```
- **Response**: `200 OK`

### `POST /api/wallet/pay-bill`
Settles utility bill payment (Electricity, Water, Gas, Internet).
- **Request Body**:
  ```json
  {
    "billerId": "DPDC",
    "billAccountNumber": "1002345678",
    "amountPoisha": 120000,
    "idempotencyKey": "req-bill-12345"
  }
  ```

### `POST /api/wallet/add-money`
Simulates top-up from an internal demo bank or card.

---

## 3. Agents & Agent Ecosystem

### `GET /api/agents`
Returns the active Agent Directory for Cash Out selection.
- **Response**: `200 OK`
  ```json
  {
    "agents": [
      {
        "agentId": "AGT-6666-335",
        "name": "Rahim Cash Point",
        "phone": "01755556666",
        "location": "Banani, Dhaka",
        "status": "active"
      }
    ]
  }
  ```

### `GET /api/agents/lookup/:identifier`
Looks up an active Agent by phone number or Agent ID (`AGT-XXXX`).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "agent": {
      "agentId": "AGT-1303-561",
      "name": "Kamal Cash Point",
      "businessName": "Kamal Cash Point",
      "phone": "01711221303",
      "location": "Dhanmondi, Dhaka"
    }
  }
  ```

### `GET /api/agents/dashboard`
Returns live collection metrics, settlement float, and transaction stream for the logged-in Agent.
- **Response**: `200 OK`
  ```json
  {
    "dashboard": {
      "agentId": "AGT-6666-335",
      "walletBalancePoisha": 1100000,
      "todayStats": {
        "count": 1,
        "volumePoisha": 100000
      },
      "todayTransactions": [...]
    }
  }
  ```

---

## 4. Scheduling & Conditional Rules

### `POST /api/schedules/prepare`
Prepares a scheduled action, creates an auditable `PendingAction` in MongoDB, and computes an immutable canonical `actionHash`.
- **Request Body**:
  ```json
  {
    "actionType": "send_money",
    "targetPhone": "01733334444",
    "amountPoisha": 50000,
    "frequency": "recurring_monthly",
    "executeAt": "2026-11-05T14:00:00.000Z",
    "mandateLimitPoisha": 250000
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "pendingAction": {
      "actionId": "act-sched-...",
      "actionHash": "a1b2c3d4e5f6...",
      "tool": "create_schedule",
      "requiredTier": "T2"
    }
  }
  ```

### `POST /api/schedules/confirm`
Confirms and activates the prepared schedule using the canonical `actionHash` and Tier 2 step-up token. Consumes the step-up token immediately to prevent replay.
- **Headers**:
  - `x-step-up-token`: `<stepUpToken>`
  - `x-action-hash`: `<canonicalActionHash>`
- **Request Body**:
  ```json
  {
    "actionId": "act-sched-..."
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "schedule": { ... }
  }
  ```

### `POST /api/schedules/rules/prepare`
Prepares an event-driven conditional rule (e.g. trigger on `wallet_credit`), creates a `PendingAction`, and computes the canonical `actionHash`.
- **Request Body**:
  ```json
  {
    "trigger": "wallet_credit",
    "condition": {
      "minAmountPoisha": 100000
    },
    "actionType": "pay_bill",
    "actionPayload": {
      "billerId": "DPDC",
      "amountPoisha": 120000
    }
  }
  ```
- **Response**: `201 Created`

### `POST /api/schedules/rules/confirm`
Confirms and activates the conditional rule using Tier 2 step-up token and canonical `actionHash`. Enforces anti-replay token consumption.
- **Headers**:
  - `x-step-up-token`: `<stepUpToken>`
  - `x-action-hash`: `<canonicalActionHash>`
- **Request Body**:
  ```json
  {
    "actionId": "act-rule-..."
  }
  ```
- **Response**: `201 Created`


---

## 5. AI Copilot & Two-Phase Execution

### `POST /api/agent/chat`
Processes natural language instructions in English or Bangla.
- Distinguishes Intent: `IMMEDIATE`, `SCHEDULED`, `RECURRING`, `CONDITIONAL`, `REMINDER`.
- Blocks prompt injection and sensitive data extraction.
- Emits a `PendingAction` preview card rather than executing directly.
- **Request Body**:
  ```json
  {
    "messageText": "Tomorrow at 8 PM send 500 to Rahim",
    "language": "en"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "reply": "Please confirm to schedule ৳500 to Rahim tomorrow at 8 PM.",
    "pendingAction": {
      "actionId": "sched-act-...",
      "tool": "create_schedule",
      "args": { ... },
      "preview": { ... }
    }
  }
  ```

### `POST /api/agent/confirm-action`
Executes an approved `PendingAction` upon verifying T2 step-up PIN authorization.

---

## 6. Guardian Mode & Protected Profiles

### `GET /api/guardians/status`
Returns guardian links, wards, and protected child profiles under the authenticated user.

### `GET /api/guardians/pending-approvals`
Returns all pending transactions initiated by wards or children that are held awaiting this guardian's review.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "pendingApprovals": [
      {
        "id": "6ab...",
        "type": "send",
        "amountPoisha": 60000,
        "feePoisha": 0,
        "sender": { "name": "Abir", "phone": "01799887766" },
        "recipient": { "name": "Rahim", "phone": "01733334444" },
        "reason": "Exceeds child daily spending limit of ৳500"
      }
    ]
  }
  ```

### `POST /api/guardians/approvals/:txnId/decide`
Guardian approves or rejects a held transaction. Requires T2 PIN step-up authentication.
- **Headers**:
  - `x-step-up-token`: `<token>`
  - `x-action-hash`: `guardian-approve-<txnId>`
- **Request Body**:
  ```json
  {
    "decision": "approve"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "status": "settled",
    "message": "Transaction approved and settled successfully."
  }
  ```

### `POST /api/guardians/child`
Creates a child account atomically and establishes an active `ProtectedProfile` with a daily spending cap.
- **Request Body**:
  ```json
  {
    "name": "Abir",
    "phone": "01799887766",
    "pin": "1234",
    "dailyLimitPoisha": 50000
  }
  ```

---

## 7. AI Copilot & Natural Language Actions

The AI Copilot connects natural language instructions (Bangla or English) directly to the application's single service layer. Read tools execute instantly from MongoDB, while money-moving tools generate an auditable, time-limited `PendingAction` requiring Tier 2 (PIN step-up) confirmation.

### `POST /api/copilot/message` (or `/api/agent/message`)
Processes a natural language command from the user.
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request Body**:
  ```json
  {
    "message": "check my balance",
    "language": "en"
  }
  ```
- **Read Tool Response**:
  ```json
  {
    "reply": "Your current wallet balance is ৳10000.00",
    "pendingAction": null
  }
  ```
- **Mutation Tool Response (Requires Confirmation)**:
  ```json
  {
    "reply": "To send ৳500.00 to Kabir (01720000002), please confirm below with your PIN.",
    "pendingAction": {
      "actionId": "act-61266e76-...",
      "tool": "send_money",
      "args": { "recipientPhone": "01720000002", "amountPoisha": 50000 },
      "preview": {
        "title": "Confirm Send Money to Kabir",
        "amountPoisha": 50000,
        "feePoisha": 0,
        "totalPoisha": 50000,
        "recipientLabel": "Kabir"
      },
      "requiredTier": "T2",
      "expiresAt": "2026-10-03T03:10:00.000Z"
    }
  }
  ```

### `POST /api/copilot/confirm` (or `/api/agent/confirm`)
Executes an active `PendingAction` created by the Copilot after verifying the user's PIN step-up token and canonical `actionHash`.
- **Headers**:
  - `Authorization: Bearer <accessToken>`
  - `x-step-up-token`: `<stepUpToken>`
  - `x-action-hash`: `<actionHash>`
- **Request Body**:
  ```json
  {
    "actionId": "send-act-61266e76-..."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "tool": "send_money",
    "result": { "message": "Transaction completed successfully." }
  }
  ```

### `GET /api/copilot/memory`
Retrieves the user's persistent `FinancialMemory`, including active micro-savings rules, guardian alert preferences, and remembered goals.
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "memory": {
      "microSavings": {
        "enabled": true,
        "mode": "percentage",
        "percentage": 2,
        "roundUpUnit": 10000,
        "thresholdMinPoisha": 50000,
        "paused": false,
        "totalSavedPoisha": 1600
      },
      "financialGoals": [
        {
          "keyword": "laptop",
          "title": "laptop Goal",
          "targetPoisha": 6000000,
          "notes": "Saving for laptop"
        }
      ]
    }
  }
  ```

### `POST /api/copilot/savings/configure`
Configures or pauses/resumes the user's automated micro-savings settings.
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request Body**:
  ```json
  {
    "enabled": true,
    "mode": "percentage",
    "percentage": 2,
    "paused": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "microSavings": {
      "enabled": true,
      "mode": "percentage",
      "percentage": 2,
      "paused": false
    }
  }
  ```

---

## 7. Account Management & Savings

### `POST /api/auth/change-pin`
Validates current PIN, verifies 4-digit formatting, updates PIN hash via bcrypt, and records an auditable log entry.
- **Request Body**:
  ```json
  {
    "currentPin": "1234",
    "newPin": "5678",
    "confirmPin": "5678"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "PIN changed successfully"
  }
  ```

### `GET /api/wallet/linked-accounts`
Fetches active linked bank accounts, cards, and MFS accounts for the authenticated user.

### `POST /api/wallet/linked-accounts`
Links a new bank account or card with validation.
- **Request Body**:
  ```json
  {
    "institutionName": "Sonali Bank PLC",
    "accountNumber": "1234567890123",
    "accountType": "bank",
    "holderName": "Rakib"
  }
  ```

### `DELETE /api/wallet/linked-accounts/:id`
Unlinks a connected account.

### `GET /api/wallet/savings-plans`
Fetches all savings goals and DPS schemes for the authenticated user (seeds default starter plans if none exist).

### `POST /api/wallet/savings-plans`
Creates a custom dynamic savings goal or DPS scheme.
- **Request Body**:
  ```json
  {
    "planType": "savings",
    "title": "Emergency Fund",
    "targetAmountPoisha": 5000000,
    "installmentAmountPoisha": 50000,
    "frequency": "monthly",
    "durationMonths": 12,
    "interestRatePercent": 7.5,
    "autoDebit": false
  }
  ```

### `POST /api/wallet/savings-plans/:id/deposit`
Deposits money from user's primary wallet into the target savings plan atomically, logging a `savings_deposit` ledger transaction.
- **Request Body**:
  ```json
  {
    "amountPoisha": 50000
  }
  ```

---

## 8. Realtime WebSocket Architecture (Socket.IO)

Guardian MFS incorporates low-latency, bidirectional WebSocket communication via Socket.IO. Socket.IO strictly complements existing REST endpoints; REST endpoints remain authoritative and the application gracefully falls back to REST if the socket disconnects.

### Connection Handshake & Authentication
Clients authenticate during the WebSocket handshake using the standard JWT access token:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
```

### Room Architecture
- `user:<userId>`: Automatically joined upon successful handshake. Used for private user dispatches (balance updates, incoming transactions, notifications, and guardian alerts).
- `group_bill:<requestId>`: Joined dynamically when viewing or interacting with a split bill request via `join_room` / `leave_room`.

### Client-to-Server Events
- `join_room`: Join a resource room (e.g. `socket.emit('join_room', 'group_bill:65e123...')`).
- `leave_room`: Leave a resource room (e.g. `socket.emit('leave_room', 'group_bill:65e123...')`).

### Server-to-Client Realtime Events
- `wallet:balance`:
  ```json
  {
    "balancePoisha": 925000
  }
  ```
  Immediately updates the authenticated user's wallet balance in the UI store without page reload.

- `transaction:new`:
  ```json
  {
    "transaction": {
      "_id": "6701...",
      "type": "send",
      "amount": 75000,
      "fee": 0,
      "total": 75000,
      "status": "settled",
      "metadata": {
        "senderPhone": "01719998877",
        "senderName": "Sadia",
        "recipientPhone": "01728889900",
        "recipientName": "Karim"
      },
      "createdAt": "2026-10-03T13:19:00.000Z"
    }
  }
  ```
  Prepends newly settled or pending transactions to the user's live History feed.

- `notification:new`:
  ```json
  {
    "notification": {
      "_id": "6702...",
      "title": "টাকা গ্রহণ (Money Received)",
      "body": "সাদিয়া ইসলাম (01719998877) থেকে ৳750.00 প্রাপ্ত হয়েছে।",
      "type": "transaction",
      "isRead": false,
      "createdAt": "2026-10-03T13:19:00.000Z"
    }
  }
  ```
  Increments unread notification count badge and prepends to the notification modal feed in real time.

- `guardian:approval_request`:
  ```json
  {
    "txnId": "6703...",
    "amountPoisha": 50000,
    "senderUserId": "6704...",
    "senderName": "Aayan",
    "senderPhone": "01730000001",
    "recipientPhone": "01740000002",
    "reason": "Exceeds daily spending limit (৳500.00)"
  }
  ```
  Dispatched instantly to the guardian when a child transaction enters `awaiting_guardian`. Triggers pending approval banner and live modal refresh.

- `guardian:approval_decided`:
  ```json
  {
    "txnId": "6703...",
    "status": "approved",
    "reason": "Approved by guardian"
  }
  ```
  Notifies child and guardian of the decision, auto-clearing approval lists and updating the transaction status.

- `group_bill:update`:
  ```json
  {
    "request": {
      "_id": "6705...",
      "title": "Dinner split",
      "status": "active",
      "collectedAmount": 120000,
      "participants": [...]
    }
  }
  ```
  Dispatched to the shared group room and participant rooms whenever a member pays their share.

- `savings:update`:
  ```json
  {
    "plan": {
      "_id": "6706...",
      "currentAmountPoisha": 550000,
      "targetAmountPoisha": 5000000
    }
  }
  ```
  Dispatched when an installment or deposit is made into a savings goal or DPS scheme.

- `savings:config`:
  ```json
  {
    "microSavings": {
      "mode": "percentage",
      "percentage": 5,
      "roundUpUnit": 5000,
      "thresholdMinPoisha": 50000,
      "targetPlanId": "6706...",
      "isPaused": false,
      "isEnabled": true
    }
  }
  ```
  Dispatched when micro-savings configuration is updated via Manual UI or AI Copilot.

---

## 9. Manual Savings Customization & Plan Lifecycle

### `GET /api/wallet/savings/config`
Fetches the user's active micro-savings configuration, linked target plan, and list of available active savings goals.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "config": {
      "mode": "percentage",
      "percentage": 5,
      "roundUpUnit": 5000,
      "thresholdMinPoisha": 50000,
      "targetPlanId": "6706...",
      "isPaused": false,
      "isEnabled": true,
      "totalSavedPoisha": 150000
    },
    "microSavings": { ... },
    "targetPlan": { ... },
    "activePlans": [ ... ]
  }
  ```

### `POST /api/wallet/savings/config`
Updates or reconfigures micro-savings parameters manually from the UI or programmatic agent. Validates percentage bounds (1%–25%), round-up units, and persistence to `FinancialMemory`. Dispatches `savings:config` realtime event.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "mode": "percentage",
    "percentage": 5,
    "roundUpUnit": 5000,
    "thresholdMinPoisha": 50000,
    "targetPlanId": "6706...",
    "isPaused": false,
    "isEnabled": true
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "config": { ... },
    "microSavings": { ... }
  }
  ```

### `PATCH /api/wallet/savings-plans/:id`
Updates title, target amount, installment, or duration of an existing savings goal or DPS plan. Dispatches `savings:update` realtime event.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "title": "Summer Vacation Trip",
    "targetAmountPoisha": 6000000
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Savings plan updated successfully.",
    "plan": { ... },
    "savingsPlan": { ... }
  }
  ```

### `DELETE /api/wallet/savings-plans/:id`
Safely cancels an active savings plan or goal. If funds have accumulated (`currentAmountPoisha > 0`), the accumulated balance is atomically refunded back to the user's primary wallet inside a MongoDB session transaction with an immutable `savings_withdraw` ledger transaction. Dispatches `wallet:update` and `savings:update` realtime events.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Plan cancelled. ৳1,000.00 refunded to your primary wallet.",
    "refundedPoisha": 100000,
    "savingsPlan": { ... }
  }
  ```

---

## 10. AI Financial Copilot Security, Boundaries & Hardening

The AI Financial Copilot (`/api/ai/chat`) is hardened against real-world ambiguous, adversarial, and edge-case inputs:

1. **Clarification Handling (Zero Speculative Money Movement)**:
   - Recipient without amount: Asks user for amount before creating `PendingAction`.
   - Amount without recipient: Asks user for recipient phone before creating `PendingAction`.
   - Ambiguous commands ("Change my savings", "Remind me later", "Save more", "Pay"): Asks specific clarifying questions with actionable examples.
2. **Boundary & Invalid Input Rejections**:
   - Rejects negative and zero amounts without creating `PendingAction`.
   - Rejects out-of-range savings percentages (valid range: 1% to 25%).
   - Rejects past reminder dates.
   - Rejects self-transfers (sending money to own phone number).
   - Rejects transactions exceeding single-transaction limits (৳25,000).
3. **Security, Secret Protection & Privacy Barriers**:
   - Secret Probes: Strictly refuses requests asking for PIN, OTP, or password credentials.
   - Privacy Barrier: Strictly blocks queries attempting to access other users' balances, transactions, or account profiles.
   - Adversarial Prompt Injections: Blocks jailbreak instructions attempting to bypass confirmation, bypass PIN, or override policy.
4. **Conflict Detection & Multi-Intent Parsing**:
   - Halts conflicting simultaneous commands (e.g. enable + disable savings, pause + resume, send + cancel).
   - Safely parses independent multi-intent clauses joined by "and" / "এবং" (e.g. "Check balance and show my spending").
5. **Bilingual & Banglish NL Understanding**:
   - Accurately processes natural Banglish expressions ("amar balance koto", "savings bondho koro", "taka pathate chai").

---

## 11. AI Copilot Conversational & Long-Term Memory

### `GET /api/copilot/history`
Retrieves persistent conversation history for the authenticated user in chronological order.
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**: `limit` (optional, default `40`)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "history": [
      {
        "id": "6ac3f...",
        "sender": "user",
        "text": "Remember that Rakib is my brother",
        "createdAt": "2026-10-06T01:30:00.000Z"
      },
      {
        "id": "6ac3f...",
        "sender": "agent",
        "text": "📝 Noted and recorded: Rakib is your brother.",
        "createdAt": "2026-10-06T01:30:01.000Z"
      }
    ]
  }
  ```

### `DELETE /api/copilot/history`
Clears persistent chat history for the authenticated user.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Conversation history cleared successfully."
  }
  ```

### `GET /api/copilot/memory`
Retrieves all remembered facts, contact relationship aliases, saved utility accounts, financial preferences, and context notes.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "contactAliases": [
      {
        "alias": "brother",
        "name": "Rakib",
        "phone": "01710000002",
        "relationship": "brother"
      }
    ],
    "utilityAccounts": [
      {
        "billerId": "DESCO",
        "accountNo": "442109",
        "nickname": "DESCO Account"
      }
    ],
    "contextNotes": [
      {
        "fact": "I prefer paying rent in the first week",
        "category": "general"
      }
    ],
    "summaryBn": "...",
    "summaryEn": "..."
  }
  ```

### `POST /api/copilot/memory`
Remembers a new personal fact, contact alias, or utility account.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "fact": "Karim is my brother"
  }
  ```
- **Response**: `201 Created`

### `DELETE /api/copilot/memory/:id`
Deletes a specific remembered fact or alias by ID.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

### `DELETE /api/copilot/memory`
Clears all remembered contact aliases, utility accounts, and contextual notes for the user.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`






