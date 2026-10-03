# FinMate AI: Implemented vs. Planned Feature Audit & Evidence Matrix

This document provides the definitive architectural audit of FinMate AI (Guardian MFS), establishing an honest, rigorous boundary between **what is actually implemented in the codebase** versus **what is partially implemented, UI-only, or planned**.

---

## 1. Complete Feature Inventory & Verification Matrix

| Feature / Capability | Classification Status | Codebase Evidence & Verification Path |
| :--- | :--- | :--- |
| **Integer Minor-Unit (Poisha) Accounting** | **IMPLEMENTED** | `server/src/services/ledger.service.js`, `server/src/models/ledger.model.js`. All mutations in integer poisha (`amountPoisha`). Verified in `server/tests/ledger.test.js`. |
| **Append-Only Double-Entry Books** | **IMPLEMENTED** | Balanced debit and credit entries in `LedgerEntry` schema with immutable transaction IDs. Verified in `ledger.service.test.js`. |
| **MongoDB ACID Transactions** | **IMPLEMENTED** | All ledger mutations wrapped in `mongoose.startSession()` and `session.withTransaction()`. Automatic rollback on failure. |
| **Non-Negative Balance Invariant** | **IMPLEMENTED** | Atomic conditional query enforces `balance - amountPoisha >= 0`. Insufficient funds throws `InsufficientFundsError`. |
| **Idempotency Key Deduplication** | **IMPLEMENTED** | Unique index on `idempotencyKey` in `Transaction` model prevents duplicate charges on network retries. |
| **Core Send Money Flow** | **IMPLEMENTED** | `server/src/controllers/transaction.controller.js:sendMoney`, full integration in `Home.jsx` and `CopilotModal.jsx`. |
| **Cash Out & Agent Withdrawals** | **IMPLEMENTED** | `server/src/controllers/transaction.controller.js:cashOut`, verified fee calculation (1.5% fee applied to ledger). |
| **Merchant Payment Flow** | **IMPLEMENTED** | `server/src/controllers/transaction.controller.js:merchantPay`, verified merchant credit without customer fee. |
| **Utility Bill Payment Flow** | **IMPLEMENTED** | `server/src/controllers/transaction.controller.js:payBill`, bill account lookups, synthetic utility settlements. |
| **AI Copilot Conversational Dialog** | **IMPLEMENTED** | `client/src/components/CopilotModal.jsx`, `server/src/controllers/agentCopilot.controller.js:handleCopilotQuery`. |
| **Multi-Line UX Prompt Chips** | **IMPLEMENTED** | `client/src/components/CopilotModal.jsx` (grid layout formatting prompt suggestions cleanly across two rows). |
| **Deterministic Intent Routing Engine** | **IMPLEMENTED** | `server/src/services/agentCopilot.service.js:classifyIntent` (12 intent patterns with English and Bangla phonetic support). |
| **Conversational Balance Query** | **IMPLEMENTED** | Regex triggers `INTENT_BALANCE`, calls `walletService.getWalletByUserId`, returns live ledger balance in BDT. |
| **Conversational Spending Analysis** | **IMPLEMENTED** | `agentCopilot.service.js:getSpendingAnalysis`, aggregates past 30-day transactions by category from MongoDB. |
| **Conversational Financial Memory** | **IMPLEMENTED** | `agentCopilot.service.js:getSpendingHabits`, identifies top counterparty, regular merchants, and active savings rules. |
| **Conversational Action Staging** | **IMPLEMENTED** | `agentCopilot.service.js:handleSendMoneyIntent`, creates `PendingAction` record in DB, displays confirmation card in chat. |
| **Two-Step Human-in-the-Loop PIN Modal** | **IMPLEMENTED** | `client/src/components/PinModal.jsx`, `server/src/controllers/pendingAction.controller.js:confirm`. PIN verified via bcrypt. |
| **Prompt Injection Defense Filter** | **IMPLEMENTED** | `agentCopilot.service.js:isPromptInjection` (18+ regex patterns defending against roleplay, system leak, and jailbreaks). |
| **Bangla Numeral Normalizer** | **IMPLEMENTED** | `agentCopilot.service.js:normalizeBanglaDigits` (converts `০-৯` to `0-9` before intent parsing). |
| **In-Memory TF-IDF Policy RAG** | **IMPLEMENTED** | `server/src/services/rag.service.js` (TF-IDF vectorizer + cosine similarity over `mfs_knowledge.json`). |
| **Multi-Signal Guardian Risk Engine** | **IMPLEMENTED** | `server/src/services/guardianRisk.service.js:evaluateRisk` (5 signals: New recipient, High amount, Night time, Velocity, Limit). |
| **Guardian Risk Warning UI Banner** | **IMPLEMENTED** | `client/src/components/CopilotModal.jsx` and `client/src/components/GuardianRiskBanner.jsx`. |
| **Child/Ward Account Approval Flow** | **IMPLEMENTED** | `guardianRisk.service.js:checkChildLimits`, parent approval staged in `PendingAction`, real-time alert sent to parent. |
| **Percentage-Based Micro-Savings** | **IMPLEMENTED** | `server/src/services/savingsRule.service.js`, `calculatePercentageSavings`, executed on `transaction.settled` event. |
| **Round-Up Micro-Savings** | **IMPLEMENTED** | `server/src/services/savingsRule.service.js`, `calculateRoundUpSavings` (rounds up to 10, 50, 100 poisha units). |
| **Threshold Auto-Sweep Savings** | **IMPLEMENTED** | `server/src/services/savingsRule.service.js`, `calculateThresholdSavings` (spends > threshold sweep change). |
| **Savings Goal Pace Calculator** | **IMPLEMENTED** | `server/src/services/savingsRule.service.js:calculateGoalPace`, calculates required monthly deposit from target and duration. |
| **Realtime Socket.IO Handshake Auth** | **IMPLEMENTED** | `server/src/services/socket.service.js:initSocket`, JWT verification in socket handshake middleware. |
| **Realtime Wallet Balance Push** | **IMPLEMENTED** | Server emits `wallet:balance` on transaction settlement; `client/src/hooks/useSocket.js` updates Zustand store. |
| **Realtime Transaction Feed Push** | **IMPLEMENTED** | Server emits `transaction:new` to recipient room `user:<userId>`; recipient UI appends record with zero reload. |
| **Realtime Group Bill Synchronization** | **IMPLEMENTED** | Server emits `group_bill:update` to room `group_bill:<requestId>` on contribution settlement. |
| **Group Bill Splitting Engine** | **IMPLEMENTED** | `server/src/services/groupBill.service.js`, creates split requests, tracks multi-party contributions. |
| **Scheduled Reminders & Chron Jobs** | **IMPLEMENTED** | `server/src/services/scheduler.service.js`, schedules and executes recurring reminders and bill alerts. |
| **Conversational Session Logout** | **IMPLEMENTED** | Copilot `"logout"` command triggers frontend auth store purge, severs socket, and redirects to `/login`. |
| **Biometric WebAuthn (FIDO2) Core** | **PARTIALLY IMPLEMENTED** | `@simplewebauthn/server` and `@simplewebauthn/browser` packages integrated; registration API active; fallback to PIN default. |
| **Bill Invoice OCR Image Parsing** | **PARTIALLY IMPLEMENTED** | `server/src/services/billOcr.service.js` contains regex extraction; Tesseract OCR fallback operates if binary available. |
| **Groq Cloud LLM Direct Tool Calling** | **PARTIALLY IMPLEMENTED** | `server/scripts/doctor.js` connects to Groq API with `GROQ_API_KEY`. When key is omitted, system falls back to mock mode. |
| **Offline Voice Intent Recognition** | **PLANNED / UI ONLY** | Microphone icon rendered in Copilot input; Web Speech API recognition stubbed; natural voice pipeline planned for v2. |
| **NFC Tap-to-Pay Merchant Integration**| **PLANNED / UI ONLY** | UI icon present on Merchant Pay screen; simulated via QR / mobile number entry; native NFC hardware planned for v2. |
| **Production Central Bank Rails** | **PLANNED / UI ONLY** | Real Bangladesh Bank NPSB/BEFTN/RTGS payment gateway integration is intentionally out of scope for hackathon prototype. |

---

## 2. Granular Architectural Subsystem Status

### 2.1 Financial Accounting & Transaction Processing
- **Status**: **100% Fully Implemented and Verified**
- **Evidence**:
  - `server/src/services/ledger.service.js` executes double-entry mutations with strict MongoDB session transactions.
  - Zero floating-point arithmetic: 100% integer poisha.
  - Invariant tests in `server/tests/ledger.test.js` prove that balances never go negative even under high concurrency.
  - Complete dual parity: Every action is supported via REST API and Copilot conversational routing.

### 2.2 AI Copilot & Natural Language Interface
- **Status**: **Fully Implemented (Deterministic Runtime Mode)**
- **Evidence**:
  - `client/src/components/CopilotModal.jsx` provides an ergonomic glassmorphic interface with two-line suggestion chips.
  - `server/src/services/agentCopilot.service.js` parses user intent deterministically using compiled regex patterns for English and phonetic Bangla.
  - Zero financial hallucination: Copilot formats real database records; it never invents account numbers, balances, or transaction fees.
  - Secure PendingAction cards prevent autonomous money mutation; every action requires explicit human review and PIN verification.

### 2.3 RAG & Knowledge Retrieval Subsystem
- **Status**: **Fully Implemented (In-Memory Engine)**
- **Evidence**:
  - `server/src/services/rag.service.js` implements a self-contained in-memory TF-IDF vectorizer and cosine similarity matcher over `server/src/knowledge/mfs_knowledge.json`.
  - Zero external vector database dependency (Pinecone, Chroma, or Weaviate are not used).
  - Scope is strictly bounded: RAG only retrieves institutional policy documents, transaction limits, and FAQ answers. Live financial state is never passed to RAG.

### 2.4 AI Financial Guardian (Fraud Defense)
- **Status**: **Fully Implemented and Verified**
- **Evidence**:
  - `server/src/services/guardianRisk.service.js` computes composite risk scores ($S \in [0, 1]$) across five distinct behavioral heuristics.
  - Verified under automated tests in `server/src/services/guardianRisk.test.js`.
  - Alert banners rendered in both the Copilot conversation timeline and manual transaction screens.
  - Child/ward spending limit enforcement and parent approval delegation fully operational.

### 2.5 Realtime Socket.IO Layer
- **Status**: **Fully Implemented and Verified**
- **Evidence**:
  - `server/src/services/socket.service.js` verifies JWT tokens during socket connection handshake and isolates sockets into scoped rooms (`user:<userId>`).
  - Outbound transfers emit `wallet:balance` and `transaction:new` events to the recipient's room.
  - Tested across multi-client dual browser instances: recipient screen updates balance and appends transaction instantly without page reload.

---

## 3. DOCUMENTATION RISKS: Transparency & Misconception Disclaimers

To maintain total academic and competition integrity, the following technical distinctions must be clearly understood by judges, evaluators, and report readers:

### 1. Deterministic Rule Engine vs. Cloud LLM Runtime
- **Potential Misconception**: Evaluators might assume that every conversational response is generated by a large cloud model (e.g., Llama 3 on Groq or OpenAI GPT-4).
- **Actual Reality**: FinMate AI operates on a **100% deterministic pattern-matching and intent classification engine** in its standard runtime. While `server/scripts/doctor.js` provides diagnostic connectivity to Groq (`GROQ_API_KEY`), the production runtime intentionally utilizes deterministic rule-based tool dispatching. This guarantees zero financial hallucinations, zero latency jitter, zero cloud API costs, and total offline reliability.

### 2. Simulated Synthetic Ledger vs. Real Payment Rails
- **Potential Misconception**: Evaluators might believe the app connects to live commercial banking networks or telecom USSD gateways.
- **Actual Reality**: In strict compliance with hackathon rules, **ALL MONEY IS SIMULATED AND ALL DATA IS SYNTHETIC**. The double-entry ledger is mathematically authentic and bank-grade, but it operates over an internal MongoDB instance. No live payment rails (bKash, Nagad, Bangladesh Bank NPSB) are connected.

### 3. In-Memory TF-IDF vs. Distributed Vector Databases
- **Potential Misconception**: Evaluators might expect an external vector database like Pinecone, Chroma, or Milvus with cloud embeddings.
- **Actual Reality**: RAG is implemented using a **lightweight, self-contained in-memory TF-IDF cosine similarity engine** operating directly on structured institutional JSON documents. This eliminates external vector infrastructure while providing instant, deterministic retrieval of static policies.

### 4. PIN Step-Up vs. Biometric WebAuthn
- **Potential Misconception**: Evaluators might assume that WebAuthn hardware biometric authentication is mandatory for all operations.
- **Actual Reality**: While `@simplewebauthn/server` and `@simplewebauthn/browser` are installed and backend registration endpoints exist, the **primary portable step-up mechanism demonstrated across all test cases and scripts is the 4-digit bcrypt-hashed PIN**. This ensures seamless testing across diverse browser and headless environments.

### 5. Bill OCR Image Processing
- **Potential Misconception**: Expecting real-time neural vision model inference on handwritten paper invoices.
- **Actual Reality**: `server/src/services/billOcr.service.js` provides token extraction based on structured bill formats and regex heuristics, with a graceful fallback when Tesseract OCR binary dependencies are not installed on the host OS.

### 6. Voice Recognition Input
- **Potential Misconception**: Assuming custom-trained acoustic models or automated speech recognition backends.
- **Actual Reality**: The microphone button on the Copilot UI provides an entry point that hooks into standard browser Web Speech API interfaces. The primary, fully verified conversational modality is text input.
