<div align="center">

# 🛡️ UPAY - powered by ai

**Bilingual (Bangla/English) AI Financial Operating Layer & Mobile Financial Service Platform**

![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-118%20tests-6E9F18?logo=vitest&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-10B981?logo=pwa&logoColor=white)
![Status](https://img.shields.io/badge/Status-Synthetic%20Prototype-orange)

*Single Service Layer ("Two Doors, One Brain") · Append-Only Double-Entry Ledger · Deterministic Financial Math · In-Band Guardian Risk Analysis · Automated Micro-Savings · Self-Contained RAG · Realtime Socket.IO*

</div>

---

## 📑 Table of Contents

- [Overview](#overview)
- [Problem](#problem)
- [Solution](#solution)
- [Key Features](#key-features)
- [AI Financial Copilot](#ai-financial-copilot)
- [AI Financial Guardian](#ai-financial-guardian)
- [Personalized Micro-Savings](#personalized-micro-savings)
- [Financial Personalization & Memory](#financial-personalization--memory)
- [Architecture](#architecture)
- [AI Architecture](#ai-architecture)
- [RAG Architecture](#rag-architecture)
- [Tool Calling](#tool-calling)
- [Realtime Architecture](#realtime-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Architecture](#database-architecture)
- [API Overview](#api-overview)
- [Authentication & Security](#authentication--security)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)
- [Team](#team)

---

## Overview

**UPAY powered by ai** is a next-generation mobile financial service (MFS) progressive web application (PWA). It transforms traditional menu-heavy USSD/app interfaces into an intelligent, conversational financial operating layer.

Traditional MFS platforms force users to navigate deep, fragmented menus for basic tasks, offer no contextual spending intelligence, lack automated savings mechanisms, and fail to protect vulnerable users (such as children and elderly relatives) from scams and coerced transactions. UPAY powered by ai solves this with a **unified AI Financial Copilot** that acts as the conversational operating system for the entire application.

The manual UI and the AI assistant share the **exact same backend service layer**. Money never moves based on unverified AI text. Natural language intents trigger deterministic service functions, and all mutations require an explicit two-phase confirmation card protected by PIN step-up authentication and canonical action hashing.

---

## Problem

1. **Information Fragmentation & Cognitive Load**: Users cannot easily understand where their money goes each month. MFS history screens show raw transaction lists without actionable summaries or categorization.
2. **Lack of Automated Savings**: Everyday transactions generate loose change or unbudgeted margins that get spent rather than saved. Traditional deposit schemes require manual monthly transfers.
3. **Vulnerability of Children & Seniors**: MFS fraud, phone phishing, and coercive peer pressure target vulnerable users. Existing apps offer binary account access without parental supervision or transaction risk review.
4. **Complex Navigation**: Routine tasks (checking fee differences, bill payments, scheduling recurring transfers, changing security settings) require navigating across disparate tabs and dialogs.
5. **Hallucination Risk in Financial AI**: Generic LLMs invent numbers, miscalculate balances, and cannot be trusted with authoritative monetary transactions.

---

## Solution

UPAY powered by ai introduces an **AI Financial Operating Layer** built on five pillars:

1. **Unified AI Financial Copilot**: One conversational interface that understands Bangla and English (including colloquial and transliterated phrasing) to check balances, analyze spending, configure savings, and navigate the app.
2. **Deterministic Financial Math (Zero Hallucination)**: Balances, category aggregations, month-over-month comparisons, and habit evaluations are computed strictly by database aggregation queries and deterministic service algorithms in pure integer poisha.
3. **In-Band AI Financial Guardian**: Outgoing transactions are evaluated in real time for risk signals (unfamiliar recipients, abnormal amounts vs. historical baseline, unusual late-night hours, rapid bursts) and present explainable review cards before confirmation.
4. **Deterministic Micro-Savings Engine**: Automated deduction in 4 modes (Percentage, Round-up, Goal-based, Threshold), executing double-entry ledger transfers into savings vaults upon transaction settlement.
5. **Two-Phase Security Boundary**: Destructive or money-moving operations never execute directly from chat. The Copilot creates a canonical `PendingAction` preview card requiring Tier 2 (PIN step-up) verification with anti-replay protection.

---

## Key Features

- **Core MFS Financial Rails (Simulated)**: Send Money (P2P), Cash Out (Customer-to-Agent, 1.5% fee), Mobile Recharge (GP, Robi, Banglalink, Teletalk, Airtel), Utility Bill Payment (DPDC, DESCO, WASA), Add Money (Simulated Bank/Card).
- **Append-Only Double-Entry Ledger**: Every financial mutation writes paired, immutable debit/credit entries inside MongoDB transactions with strict idempotency keys. Floating-point arithmetic is prohibited (`100 poisha = ৳1.00`).
- **AI Financial Copilot**: Multilingual conversational layer that runs MongoDB-backed read tools and generates two-phase mutation cards.
- **AI Financial Guardian & Child Mode**: Parent-child relationship management with 3 persistent control modes (`APPROVAL_REQUIRED`, `LIMITED`, `UPDATES_ONLY`), daily spend caps, and remote transaction authorization.
- **Explainable Scam Detection**: Deterministic, rule-based analysis of suspicious SMS and payment request messages (credential harvesting, lottery scams, false urgency, impersonation).
- **Personalized Micro-Savings**: 4 automated savings modes with pause/resume controls and dedicated goal tracking (e.g., saving for a laptop).
- **Persistent Financial Memory**: Micro-savings rules, alert preferences, and goals stored in MongoDB for conversational recall.
- **RAG Knowledge Pipeline**: Fast TF-IDF vector similarity engine over official MFS documentation and fee schedules.
- **Automated Scheduling & Conditional Rules**: Lease-locked persistent scheduler worker (5s poll interval) for one-time and recurring payments, plus event-driven `wallet.credit` reactive rules.
- **Group Bill Splitting**: Multi-party payment requests with equal or custom splits, individual settlement tracking, and auto-completion.
- **Realtime Socket.IO Sync**: Low-latency events for live balance updates, incoming transactions, notifications, guardian approval requests, and bill split progress.
- **Accessibility & Design System**: High-contrast dark and light modes, filled RGB SVG iconography, persistent sticky navigation, and hidden scrollbars with full scroll usability.

---

## AI Financial Copilot

The Copilot lives in `AgentModal.jsx` and is powered by `server/src/services/agentCopilot.service.js`.

**Capabilities**

- **Balance & Account Inquiries**: Returns live MongoDB wallet balances and tier status.
- **Spending & Income Summaries**: Aggregates outgoing and incoming funds over 7-day or 30-day windows across categories (`send`, `cash_out`, `bill`, `recharge`, `group_bill`).
- **Month-over-Month Comparison**: Computes exact expenditure differences and percentage variances between the current and previous calendar months.
- **Financial Habits Explanation**: Answers queries like *"Why am I running out of money every month?"* by analyzing the past 90 days of transactions, identifying top expense categories, and comparing monthly inflow vs. outflow.
- **Missing Parameter Clarification**: *"Send money to Rahim"* triggers a follow-up question for the amount rather than defaulting or failing.
- **Application Control**: *"Logout"* terminates the session, *"Change my PIN"* opens the secure modal without exposing PINs to chat, and *"Open transaction history"* navigates the UI.

---

## AI Financial Guardian

The Guardian operates as both an in-band transaction risk analyzer and a dedicated parental protection layer.

### 1. In-Band Risk Analysis (`guardianRisk.service.js`)

Before an outgoing transaction is confirmed, the engine evaluates real historical signals:

| Signal | Code | Trigger | Risk Score |
| :--- | :--- | :--- | :---: |
| New Recipient | `NEW_RECIPIENT` | Phone number never previously sent to by this account | +0.35 |
| Unusual High Amount | `UNUSUAL_HIGH_AMOUNT` | Amount > 2.5× historical average and > ৳1,000 | +0.35 |
| Exceeds Historical Max | `EXCEEDS_HISTORICAL_MAX` | Amount > previous record high and > ৳2,000 | +0.20 |
| Unusual Time | `UNUSUAL_TIME` | Activity between 1:00 AM and 5:00 AM local time | +0.15 |
| Rapid Transactions | `RAPID_TRANSACTIONS` | 3+ transactions within 10 minutes | +0.25 |

If any risk reasons are detected, the Copilot embeds a structured, bilingual warning card in the confirmation modal explaining the exact reasons for caution.

### 2. Child Protection & Parental Controls (`guardian.service.js`)

Accounts registered with `accountType: 'CHILD'` link to a parent account. The parent selects one of three control modes:

1. **`APPROVAL_REQUIRED`**: Child transfers are held in `awaiting_guardian` status until the parent enters their PIN in `GuardianApprovalModal.jsx`.
2. **`LIMITED`**: Transfers up to the daily limit (e.g., ৳500) settle automatically. Transfers above the limit are blocked.
3. **`UPDATES_ONLY`**: Transfers settle normally, and real-time Socket.IO notifications are sent to the parent.

---

## Personalized Micro-Savings

Implemented in `server/src/services/microSavings.service.js`, supporting 4 modes:

| Mode | Formula | Example |
| :--- | :--- | :--- |
| **A — Percentage** | `Math.round((amountPoisha * percentage) / 100)` | ৳300 spend @ 2% = **৳6.00** saved; ৳500 spend @ 2% = **৳10.00** saved |
| **B — Round-Up** | `roundUpUnit - (amountPoisha % roundUpUnit)` | ৳87 rounded to ৳100 = **৳13.00** saved; ৳463 rounded to ৳500 = **৳37.00** saved |
| **C — Goal-Based** | `Math.round(targetPoisha / durationMonths)` | ৳10,000 goal in 3 months = **~৳3,333.33/month** pace |
| **D — Threshold** | If `spend > threshold`, round up to next `roundUpUnit` | ৳670 spend (> ৳500) rounded to ৳700 = **৳30.00** saved |

### Automated Event Bus Deduction

When any outgoing transaction settles, `eventBus.js` emits `transaction.settled`. The micro-savings service then:

1. Checks active rules in `FinancialMemory`
2. Verifies wallet balance
3. Opens a MongoDB transaction session
4. Debits the primary wallet and credits the user's `SavingsPlan`
5. Writes a paired double-entry ledger entry
6. Emits Socket.IO balance and savings updates

---

## Financial Personalization & Memory

User financial context and rules are persisted in MongoDB via the `FinancialMemory` model:

- **`microSavings`**: Enabled status, active mode, custom percentage, round-up units, threshold limits, pause state, and cumulative saved amount.
- **`financialGoals`**: User-defined goal bookmarks (e.g., keyword `"laptop"`, target `6000000` poisha / ৳60,000).
- **Authoritative Natural Language Recall**: Asking *"How am I doing with my laptop?"* queries `FinancialMemory`, links to the authoritative `SavingsPlan`, and returns exact live progress without hallucination.

---

## Architecture

UPAY powered by ai follows a strict **Single Service Layer** architecture:

```
[ User Manual UI (React PWA) ]       [ AI Financial Copilot ]
               \                                /
                \                              /
           [ Express REST API / Controllers ]
                           |
             [ Single Service Layer ]
     (transaction, guardian, microSavings,
      financialAnalysis, scheduler, rule)
                           |
       [ MongoDB Transactions & Ledger ]
```

- **Two Doors, One Brain**: HTTP routes and AI Copilot tools call identical functions in `server/src/services/*`. No financial logic lives in React components, route handlers, or prompts.
- **Append-Only Double-Entry Ledger**: Balances are mutated solely by paired debit/credit `LedgerEntry` records inside MongoDB ACID transactions.
- **Two-Phase Commit for AI Mutations**: The Copilot cannot execute money mutations directly. It generates a `PendingAction` preview. The user confirms via a modal PIN prompt that produces an ephemeral Tier 2 step-up token bound to the action's canonical SHA-256 hash.

---

## AI Architecture

```
User Command (Text / Voice)
       │
       ▼
classifyIntent() ───► [Prompt Injection Defense] (Keyword & regex filter)
       │
       ├─► App Control (logout, change_pin, navigate)
       ├─► Read Tools (balance, spend_summary, habits_explanation) ──► MongoDB
       ├─► Micro-Savings (set_percentage, roundup, pause/resume) ────► FinancialMemory
       ├─► Knowledge Query ──────────────────────────────────────────► TF-IDF RAG
       └─► Mutation (send_money, recharge, pay_bill)
                 │
                 ▼
       evaluateGuardianRisk() & evaluateGuardianPolicy()
                 │
                 ▼
       computeCanonicalActionHash()
                 │
                 ▼
       Create PendingAction (T2 Step-Up Required)
                 │
                 ▼
       Client Renders Confirmation Card with Risk Reasons
                 │
                 ▼ (User enters 4-digit PIN)
       /api/auth/step-up ──► /api/copilot/confirm ──► Single Service Execution
```

### Deterministic vs. LLM Boundary

- **Current Runtime Execution**: The Copilot uses a deterministic intent classification and slot-filling engine with prompt injection detection, regex numeral extraction (English `0-9` and Bangla `০-৯`), and direct service dispatch.
- **Groq Integration**: `server/scripts/doctor.js` provides diagnostics for Groq endpoints (`GROQ_API_KEY`). Without an API key, the system runs in deterministic mode with a visible "Live / Mock Mode" status badge.
- **Prompt Injection Defense**: 18+ adversarial patterns (e.g., *"ignore previous instructions"*, *"disable guardian"*, *"send without pin"*) are blocked at the classification boundary with security alerts.

---

## RAG Architecture

Implemented in `server/src/services/rag.service.js`:

- **Document Store**: `server/src/knowledge/mfs_knowledge.json` with structured chunks covering Send vs. Cash Out, Fee Schedules, Micro-Savings Guide, Guardian Mode Policies, PIN/Security Guidelines, Group Bill Splitting, and Account Tiers.
- **Algorithm**: Self-contained term-frequency calculation with cosine similarity matching in pure Node.js.
- **Tokenization**: Unicode alphanumeric tokenizer (`\p{L}\p{N}`) handling English and Bangla scripts.
- **Strict Isolation**: RAG is restricted to static documentation, policies, and FAQs. It is never used to answer balance or transaction queries.

---

## Tool Calling

| Tool Name | Type | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `check_balance` | Read | Tier 1 (Authenticated) | Queries primary/agent wallet balance from MongoDB. |
| `get_spending_summary` | Read | Tier 1 | Aggregates category spending over 7-day or 30-day windows. |
| `compare_spending` | Read | Tier 1 | Calculates month-over-month spending variance. |
| `explain_habits` | Read | Tier 1 | Evaluates 90-day cash flow patterns and top expense categories. |
| `get_remembered_goal` | Read | Tier 1 | Retrieves live progress for remembered goals. |
| `retrieve_knowledge` | Read | Public / Tier 1 | RAG cosine similarity documentation retrieval. |
| `send_money` | Mutation | Tier 2 (PIN Step-Up) | P2P fund transfer with Guardian risk review. |
| `cash_out` | Mutation | Tier 2 (PIN Step-Up) | Customer-to-Agent withdrawal with 1.5% fee. |
| `mobile_recharge` | Mutation | Tier 2 (PIN Step-Up) | Airtime recharge with auto-operator detection. |
| `pay_bill` | Mutation | Tier 2 (PIN Step-Up) | Utility bill settlement (DPDC, WASA, DESCO). |
| `create_schedule` | Mutation | Tier 2 (PIN Step-Up) | One-time or recurring scheduled transfer. |
| `create_rule` | Mutation | Tier 2 (PIN Step-Up) | Event-driven conditional automation rule. |
| `configure_savings` | Mutation | Tier 1 | Sets percentage, round-up, or threshold micro-savings. |
| `app_logout` | Control | Tier 1 | Clears client auth session and redirects to `/`. |
| `app_change_pin` | Control | Tier 1 | Dispatches `mfs:open_modal` to open the secure PIN modal. |
| `app_navigate` | Control | Tier 1 | Navigates the client router to the specified view. |

---

## Realtime Architecture

UPAY powered by ai uses Socket.IO (`server/src/services/socket.service.js` and `client/src/hooks/useSocket.js`) for instant UI synchronization:

- **Handshake Authentication**: Sockets authenticate via JWT access tokens during the handshake. Unauthenticated connections are rejected.
- **Room Isolation**: Every socket joins a private room: `user:<userId>`.
- **Dynamic Resource Rooms**: Group bill split rooms (`group_bill:<requestId>`) broadcast share payments to all participants live.
- **Graceful Degradation**: If WebSockets disconnect, the application stays fully operational via standard REST API calls.

### Event Catalog

| Event Name | Sender | Receiver | Purpose |
| :--- | :--- | :--- | :--- |
| `wallet:balance` | Server | User Room | Updates the global balance display on ledger credit/debit. |
| `transaction:new` | Server | User Room | Prepends a settled transaction to History in real time. |
| `notification:new` | Server | User Room | Increments the unread badge and updates the notification drawer. |
| `guardian:approval_request` | Server | Guardian Room | Alerts a parent that a child transaction needs PIN approval. |
| `guardian:approval_decided` | Server | Ward & Guardian Rooms | Notifies child and parent when a held transfer is approved/rejected. |
| `group_bill:update` | Server | Resource Room | Updates split progress bar and participant status. |
| `savings:update` | Server | User Room | Updates live savings plan balance after a micro-savings auto-debit. |

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js (ES modules), Express, Mongoose (MongoDB 7+), Socket.IO, Pino, Zod, Bcryptjs, JSONWebToken, Helmet, Cors, Express-Rate-Limit |
| **Frontend** | React 18, Vite 6, Tailwind CSS, Zustand, React Router 7, React Icons, i18next (Bangla & English), `@fontsource/hind-siliguri`, `@fontsource/inter`, `vite-plugin-pwa` |
| **Testing & Tooling** | Vitest, Supertest, Puppeteer-Core, ESLint, Prettier, Mongodb-Memory-Server |

---

## Project Structure

```
mfs/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── agent/AgentModal.jsx         # Primary AI Financial Copilot Modal
│   │   │   ├── auth/GuestAuthScreen.jsx     # Login & Registration Screen
│   │   │   ├── layout/                      # Header, BottomNav, FrameWrapper
│   │   │   ├── modals/                      # Send, CashOut, Savings, Guardian, etc.
│   │   │   └── ui/                          # BrandMark, FlaticonIcons (27 RGB SVGs)
│   │   ├── hooks/useSocket.js               # Realtime Socket.IO React hook
│   │   ├── locales/                         # bn.json & en.json i18n dictionaries
│   │   ├── pages/                           # Home, Account, History, More
│   │   ├── services/socket.js               # Client Socket.IO connection manager
│   │   └── stores/                          # authStore, systemStore, themeStore
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── config/                          # db.js, env.js
│   │   ├── knowledge/mfs_knowledge.json     # RAG documentation base
│   │   ├── middleware/                      # auth.js, rateLimiter.js, validate.js
│   │   ├── models/                          # 19 Mongoose schemas (Ledger, Txn, etc.)
│   │   ├── routes/                          # 9 Express routers
│   │   ├── services/                        # 16 core business services
│   │   └── utils/                           # logger.js, formatters.js
│   ├── scripts/                             # doctor.js, smoke tests, verifiers
│   └── tests/                               # 12 Vitest suites (87 tests)
├── docs/                                    # DECISIONS.md, API.md, ARCHITECTURE.md
├── AGENTS.md                                # Non-negotiable engineering rules
└── package.json
```

---

## Database Architecture

The system uses 19 MongoDB collections with strict Mongoose schemas:

| # | Collection | Purpose |
| :-: | :--- | :--- |
| 1 | `users` | Identity, 4-digit PIN hash (`bcryptjs`), role (`CUSTOMER`, `AGENT`, `CHILD`), tier (`T1`, `T2`, `T3`), lockout state |
| 2 | `wallets` | Balance in integer poisha; wallet type (`primary`, `agent`, `savings`) |
| 3 | `ledger_entries` | Append-only, immutable double-entry records (`debit` / `credit`) |
| 4 | `transactions` | Full transaction records with status lifecycle, fees, and risk payloads |
| 5 | `financial_memories` | Micro-savings rules, alert preferences, goal bookmarks |
| 6 | `savings_plans` | Goal-oriented savings targets and accrued balances |
| 7 | `protected_profiles` | Child account constraints, daily limits, control modes, spend tracking |
| 8 | `guardian_links` | Senior/ward guardian supervision relationships |
| 9 | `money_requests` | Individual payment requests and multi-party group bill splits |
| 10 | `schedules` | Recurring and one-time scheduled transactions with lease locking |
| 11 | `rules` | Event-driven reactive rules (e.g., wallet credit trigger) |
| 12 | `reminders` | Due date alerts with manual or AI-suggested origin |
| 13 | `notifications` | In-app notification queue with read state |
| 14 | `pending_actions` | Ephemeral action previews requiring PIN step-up validation |
| 15 | `consumed_tokens` | Consumed step-up token cache preventing replay attacks |
| 16 | `ai_tips` | Transaction-grounded financial advice |
| 17 | `audit_logs` | Immutable security audit trails |
| 18 | `number_reputations` | Reported spam phone records |
| 19 | `linked_accounts` | Simulated external bank accounts and cards |

---

## API Overview

Full endpoint documentation: [`docs/API.md`](docs/API.md)

| Group | Endpoints |
| :--- | :--- |
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/step-up`, `GET /api/auth/me`, `POST /api/auth/change-pin` |
| **Wallet & Transactions** | `GET /api/wallet/balance`, `GET /api/wallet/lookup-recipient/:phone`, `POST /api/wallet/send`, `POST /api/wallet/cashout`, `POST /api/wallet/bill`, `POST /api/wallet/recharge`, `POST /api/wallet/addmoney`, `GET /api/wallet/history` |
| **AI Copilot** | `POST /api/copilot/message`, `POST /api/copilot/confirm`, `GET /api/copilot/insights`, `GET /api/copilot/memory`, `POST /api/copilot/savings/configure` |
| **Guardian Mode** | `GET /api/guardians/status`, `GET /api/guardians/pending-approvals`, `POST /api/guardians/approvals/:txnId/decide`, `POST /api/guardians/children/:childId/mode` |
| **Group Bills** | `GET /api/requests`, `POST /api/requests`, `POST /api/requests/:id/pay` |
| **Schedules & Rules** | `GET /api/schedules`, `POST /api/schedules/prepare`, `POST /api/schedules/confirm`, `GET /api/schedules/rules`, `POST /api/schedules/rules/prepare`, `POST /api/schedules/rules/confirm` |
| **Safety & Scam Check** | `POST /api/safety/check-message`, `GET /api/safety/notifications`, `POST /api/safety/notifications/:id/read` |

---

## Authentication & Security

1. **Authentication**: JWT access tokens (15m expiry) with rotating refresh tokens stored in HTTP-only cookies.
2. **Tier-Based Step-Up Verification**
   - **Tier 1 (Read-Only)**: Standard JWT auth allows viewing balances, transaction histories, notifications, and analytics.
   - **Tier 2 (Financial Mutations)**: Requires entering the 4-digit PIN to obtain a short-lived (60s TTL) `stepUpToken` bound to a canonical SHA-256 `actionHash`.
3. **Anti-Replay Protection**: Step-up tokens are recorded in `consumed_tokens` upon execution. Reusing a token immediately throws an error.
4. **Brute Force Lockout**: 3 consecutive wrong PIN attempts lock the account for 15 minutes.
5. **Prompt Injection Safety**: The LLM never executes financial mutations directly. The AI layer only prepares structured parameters for user PIN authorization.

---

## Environment Variables

Copy `.env.example` to `.env` in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Database (leave blank to use auto in-memory MongoDB replica set)
MONGODB_URI=

# JWT Secrets
JWT_ACCESS_SECRET=dev-access-secret-32-characters-minimum
JWT_REFRESH_SECRET=dev-refresh-secret-32-characters-minimum

# Optional Groq LLM API Key (runs in deterministic mock mode if omitted)
GROQ_API_KEY=
GROQ_MODEL_TEXT=openai/gpt-oss-120b
```

> ⚠️ The JWT secrets above are development placeholders. Use strong, unique secrets in any non-local deployment.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/guardian-mfs.git
cd guardian-mfs

# Install all dependencies across root, server, and client workspaces
npm install

# Create your environment file
cp .env.example .env
```

---

## Running the Application

**Development mode (frontend + backend concurrently):**

```bash
npm run dev
```

**Backend only:**

```bash
npm run dev:server
```

Runs at `http://localhost:5000`. If `MONGODB_URI` is blank, an embedded in-memory MongoDB replica set is started automatically.

**Frontend only:**

```bash
npm run dev:client
```

Runs at `http://localhost:5173`.

---

## Testing

The project includes 13 Vitest suites (118 tests) covering financial integrity, concurrency, guardian flows, realtime sockets, and AI operating layer logic:

```bash
# Run all tests
npm run test

# Run AI Financial Operating Layer tests only
npx vitest run server/tests/ai_financial_operating_layer.test.js

# Lint
npm run lint

# Production client build
npm run build
```

---

## Limitations

1. **Simulated Payment Rails**: All money is synthetic. The platform does not interface with real Bangladesh Bank NPSB, BEFTN, or RTGS payment switches.
2. **Groq Key Dependency for Generative Output**: Without `GROQ_API_KEY`, the Copilot runs entirely in deterministic rule-based mode.
3. **In-Memory TF-IDF Scope**: The RAG pipeline indexes static documents from JSON and does not use an external vector database such as Pinecone or Chroma.
4. **WebAuthn Device Support**: Biometric authentication requires platform hardware support (Touch ID, Windows Hello, or Android BiometricPrompt).

---

## Future Improvements

1. External vector embeddings (e.g., `text-embedding-3-small`) with hybrid BM25 + dense vector reranking.
2. Bidirectional Bangla voice conversations via WebRTC audio streaming.
3. Sandbox banking API integration for real micro-merchant QR settlements.
4. Automated recurring investment vaults linking micro-savings to Bangladesh Treasury Bond fractions.

---

## Team

Developed for the MFS Hackathon / Competition by the **NOT HUMAN**.

> All rights reserved. Synthetic prototype. No real funds are processed.
