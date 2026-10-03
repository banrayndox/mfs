# FinMate AI: Live Demonstration Script
## Step-by-Step Evaluator & Competition Walkthrough (3–5 Minutes)

This script provides an exact, reproducible sequence for demonstrating FinMate AI live before evaluators, hackathon judges, or technical auditors. Every single step utilizes **verified, implemented, and working features** in the codebase.

---

### Prerequisites & Demo Setup
1. **Servers Running**:
   - Backend Server running on `http://localhost:5000` (or `PORT` specified in `.env`).
   - Frontend Client running on `http://localhost:5173` (Vite dev server).
   - Database: Active MongoDB instance seeded with default accounts (`node server/scripts/seed.js`).
2. **Demo User Accounts**:
   - **Sender (User A)**: Mobile `01711000001`, PIN `1234`, Balance ~`৳25,000.00`.
   - **Receiver (User B)**: Mobile `01711000002`, PIN `1234`, Balance ~`৳5,000.00`.
3. **Browser Setup**:
   - Primary Window: Chrome / Edge logged into User A (`01711000001`) at `http://localhost:5173/`.
   - Secondary Window (Side-by-Side): Incognito / Secondary Browser logged into User B (`01711000002`).

---

### Detailed Demonstration Steps

#### Step 1: Launch the AI Financial Copilot
- **Presenter Action / Command**: Click the floating circular **AI Copilot** button at the bottom-right of the dashboard (or tap the Copilot icon in the navigation bar).
- **Expected UI**:
  - The glassmorphic `CopilotModal` slides smoothly into view.
  - Greeting displayed: *"Hello, I am your FinMate AI Copilot. How can I assist your financial journey today?"*
  - Top header displays the system badge: `AI: mock mode` (or active model indicator).
  - Quick suggestion prompt chips appear neatly arranged in **two readable lines**.
- **Backend / Tool Invoked**: Frontend state trigger `setCopilotOpen(true)`; initial conversation history loaded from Zustand memory.
- **Expected Result**: Clean conversational interface opens instantly with zero layout shifts or visual scrollbars.
- **Fallback**: If the floating trigger does not respond, click the dedicated **AI Copilot** icon in the bottom navigation bar or visit `/chat`.

---

#### Step 2: Inquire About Account Balance
- **Presenter Action / Command**: Type `"check balance"` (or vernacular `"amar balance koto"`) into the input box and press Enter, or tap the **"Check Balance"** chip.
- **Expected UI**:
  - User message appears in right-aligned speech bubble.
  - Brief loading indicator pulses.
  - Assistant responds with formatted BDT balance: *"Your current available balance is ৳25,450.00 (Synthetic Demo Rails)."*
- **Backend / Tool Invoked**:
  - `agentCopilot.service.js` -> `classifyIntent()` matches `INTENT_BALANCE`.
  - Tool invoked: `walletService.getWalletByUserId(userId)`.
  - Poisha integer conversion: `poishaToBdt(wallet.balance)`.
- **Expected Result**: Exact real-time ledger balance retrieved in $< 150 \text{ ms}$ without hallucination.
- **Fallback**: If regex matching fails, click the balance pill on the Home dashboard (`Home.jsx`) to reveal the synthetic ledger balance directly.

---

#### Step 3: Show Grounded Ledger Data vs. External LLM
- **Presenter Action / Command**: Highlight the returned balance and point out the absence of latency or arbitrary generated numbers.
- **Expected UI**: Balance exactly matches the hidden balance pill on the underlying Home dashboard.
- **Backend / Tool Invoked**: Direct query to `server/src/models/wallet.model.js` within the local MongoDB instance.
- **Expected Result**: Evaluators observe that the conversational agent reads from the double-entry database, proving complete architectural parity with standard UI components.
- **Fallback**: Open browser DevTools Network tab (`F12`) to show the clean `/api/agent/copilot` JSON payload returning structured data.

---

#### Step 4: Analyze Spending & Counterparty Patterns
- **Presenter Action / Command**: Type `"analyze spending"` (or `"khoroch koto"`) and press Enter.
- **Expected UI**:
  - Copilot outputs a structured markdown breakdown:
    - **Total 30-Day Outflow**: `৳4,250.00`
    - **Send Money**: `৳2,500.00` (58.8%)
    - **Cash Out**: `৳1,000.00` (23.5%)
    - **Bill Pay**: `৳750.00` (17.7%)
    - Contextual tip: *"Your spending is highest on peer transfers. Consider enabling micro-savings to sweep spare change automatically."*
- **Backend / Tool Invoked**:
  - Intent classified as `INTENT_SPENDING_HABITS`.
  - Backend queries `transactionService.listUserTransactions(userId)` filtering completed transactions over the last 30 days.
  - Aggregation calculates totals by `transactionType`.
- **Expected Result**: Accurate categorization of recent spending derived entirely from verified ledger records.
- **Fallback**: Navigate to the `/history` screen to show the exact list of past transactions matching the aggregated numbers.

---

#### Step 5: Configure Autonomous Micro-Savings
- **Presenter Action / Command**: Type `"save 5% on every send money"` (or `"enable round up savings"`).
- **Expected UI**:
  - Copilot responds: *"Micro-savings rule activated! 5% will be automatically diverted into your savings vault on every Send Money transaction."*
  - An inline confirmation badge displays the active rule parameters: `Type: Percentage | Value: 5% | Status: Active`.
- **Backend / Tool Invoked**:
  - Intent classified as `INTENT_SAVINGS_RULE`.
  - Service invoked: `savingsRuleService.createRule(userId, { ruleType: 'percentage', percentage: 5 })`.
  - Saved to MongoDB `savingsRule` collection.
- **Expected Result**: Autonomous rule created and attached to the user's profile.
- **Fallback**: Navigate manually to `/savings` and click the toggle switch for **"5% Transfer Auto-Save"**.

---

#### Step 6: Trigger AI Financial Guardian Warning
- **Presenter Action / Command**: Type `"send 5000 to 01711000099"` (simulating a transfer to an unfamiliar recipient with an unusually high amount).
- **Expected UI**:
  - Copilot displays an **Amber/Red Alert Card** titled: `⚠️ Financial Guardian Alert: High Risk Detected`.
  - Risk Score shown: `0.70 / 1.00`.
  - Risk Factors listed:
    - *Unfamiliar counterparty (never transacted before).*
    - *Amount exceeds 2.5x your average transfer size.*
  - Guardian prompt: *"Please review this transaction carefully before proceeding."*
- **Backend / Tool Invoked**:
  - Intent classified as `INTENT_SEND_MONEY`.
  - Service invoked: `guardianRiskService.evaluateRisk({ userId, recipientPhone: '01711000099', amountPoisha: 500000 })`.
  - Evaluator scores signals: `NEW_RECIPIENT` (+0.35) + `UNUSUAL_HIGH_AMOUNT` (+0.35) = `0.70`.
- **Expected Result**: Transaction is intercepted before creation, surfacing transparent risk reasons to the user.
- **Fallback**: If the prompt fails, initiate a Send Money transfer via the manual UI to a new test number to show the Guardian warning banner.

---

#### Step 7: Initiate a Conversational Action (PendingAction)
- **Presenter Action / Command**: Type `"send 500 to 01711000002"` (User B's phone number).
- **Expected UI**:
  - Copilot evaluates risk (passes with Low Risk `0.10`).
  - Copilot generates an interactive **Pending Action Card**:
    - **Action**: Send Money
    - **Recipient**: `01711000002 (User B)`
    - **Transfer Amount**: `৳500.00`
    - **Fee**: `৳0.00` (Promotional / Tier-0)
    - **Total Deducted**: `৳500.00`
    - Interactive Button: `[ Confirm Transfer ]`
- **Backend / Tool Invoked**:
  - `agentCopilot.service.js` creates a `PendingAction` record in MongoDB with status `PENDING`.
  - Generates unique action ID and payload.
- **Expected Result**: Interactive action card embedded directly within the chat timeline. Money has NOT moved yet.
- **Fallback**: Click the manual **"Send Money"** icon on the Home dashboard, enter `01711000002` and `500`.

---

#### Step 8: Step-Up Authentication & Security PIN Entry
- **Presenter Action / Command**: Click the **`[ Confirm Transfer ]`** button on the Pending Action Card.
- **Expected UI**:
  - The `PinModal` dialog appears over the screen, requesting the user's 4-digit security PIN.
  - Numeric keypad displays with masked dots (`••••`).
- **Presenter Action / Command**: Enter PIN `1234` on the keypad and tap **"Confirm"**.
- **Expected UI**:
  - Spinner displays for $< 300 \text{ ms}$.
  - Success checkmark animation appears.
  - Copilot message updates: *"Transfer of ৳500.00 to 01711000002 completed successfully! Transaction ID: TXN_..."*
  - Sender balance updates to `৳24,950.00` (or `৳24,925.00` if 5% micro-savings rule triggered).
- **Backend / Tool Invoked**:
  - `POST /api/pending-actions/:id/confirm` with `{ pin: '1234' }`.
  - Backend verifies PIN using `bcrypt.compare`.
  - MongoDB transaction initiates: Debits User A, Credits User B, Sweeps Micro-Savings into Vault, appends double-entry records.
- **Expected Result**: Atomic settlement completed with zero ledger discrepancy.
- **Fallback**: If PIN is entered incorrectly, observe error message *"Invalid PIN. 2 attempts remaining before temporary lockout."* Re-enter `1234`.

---

#### Step 9: Real-Time Multi-Client Verification (Socket.IO)
- **Presenter Action / Command**: Immediately point evaluators to the **Secondary Window (User B)**.
- **Expected UI**:
  - **WITHOUT ANY PAGE RELOAD OR USER ACTION**:
    - User B's balance counter increments instantly by `+৳500.00`.
    - A floating toast notification pops up: *"Received ৳500.00 from 01711000001"*.
    - The top item in the transaction feed displays the new inbound transfer with a green `+৳500.00` badge.
- **Backend / Tool Invoked**:
  - `socket.service.js` emits `wallet:balance` and `transaction:new` to room `user:<userB_id>`.
  - Client hook `useSocket.js` receives event and triggers Zustand `updateBalance` and `addTransaction`.
- **Expected Result**: End-to-end real-time state synchronization verified live in $< 200 \text{ ms}$.
- **Fallback**: If socket disconnects due to localhost port blocking, click the reload icon in User B's browser to show the updated balance in the database.

---

#### Step 10: Conversational Logout & Session Invalidation
- **Presenter Action / Command**: In User A's Copilot modal, type `"logout"` (or `"sign out"`).
- **Expected UI**:
  - Copilot responds: *"Logging you out securely. Have a wonderful day!"*
  - Modal closes, `authToken` is wiped from `localStorage`, Socket.IO connection is gracefully severed.
  - App redirects immediately to `/login`.
- **Backend / Tool Invoked**:
  - `agentCopilot.service.js` recognizes logout intent and returns `{ action: 'logout' }`.
  - Frontend auth store clears session state and disconnects socket.
- **Expected Result**: User session cleanly terminated; protected routes are no longer accessible without re-authenticating.
- **Fallback**: Click Profile avatar at top-right of Home screen and select **"Logout"**.

---

### Demo Timing Guide (Total: 4 Minutes)
- **0:00 - 0:45**: Introduction & Copilot Launch (Steps 1–3).
- **0:45 - 1:45**: Spending Breakdown & Autonomous Micro-Savings (Steps 4–5).
- **1:45 - 2:45**: AI Guardian Alert & Safe Conversational Action (Steps 6–8).
- **2:45 - 3:30**: Multi-Client Real-Time Synchronization (Step 9).
- **3:30 - 4:00**: Security PIN Invariant, Session Termination & Q&A (Step 10).
