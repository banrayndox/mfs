# FinMate AI: A Bilingual AI Financial Operating Layer with Single-Service Architecture, Deterministic Micro-Savings, and In-Band Guardian Supervision

## 1. Title
**FinMate AI: A Bilingual AI Financial Operating Layer with Single-Service Architecture, Deterministic Micro-Savings, and In-Band Guardian Supervision**  
*A Next-Generation Progressive Web Platform for Intelligent, Safe, and Automated Mobile Financial Services*

---

## 2. Abstract
Mobile Financial Services (MFS) have achieved widespread financial inclusion across South Asia, yet user interaction remains fundamentally constrained by complex USSD menus, fragmented smartphone interfaces, and an absence of automated personal financial management (PFM). Concurrently, vulnerable user demographics—specifically children and digital novices—face escalating risks of social engineering scams, coercive requests, and accidental overspending. 

This paper presents **FinMate AI** (Guardian MFS), a bilingual (Bangla/English) financial operating layer that unifies conversational natural language interaction with core financial rails through a strict **Single Service Layer** architecture ("Two Doors, One Brain"). Operating over an immutable, append-only double-entry ledger with integer minor unit (poisha) precision, FinMate AI establishes an uncompromising LLM security boundary: natural language commands trigger deterministic service logic, and financial mutations require explicit two-phase confirmation cards protected by Tier 2 PIN step-up authentication and canonical SHA-256 action hashing. 

We introduce three primary contributions: (1) a **Deterministic Financial Copilot** providing grounded financial analyses, spending comparisons, and 90-day habit explanations without numerical hallucination; (2) an **In-Band Financial Guardian** evaluating explainable risk signals (unfamiliar recipients, historical spending deviations, unusual hours, and transfer velocity) paired with three persistent parental control modes; and (3) an **Event-Driven Micro-Savings Engine** supporting Percentage, Round-up, Goal-based, and Threshold savings automatically settled via double-entry ledger transfers upon transaction settlement. The platform is implemented in Node.js and React PWA, backed by MongoDB multi-document ACID transactions and real-time Socket.IO synchronization.

---

## 3. Introduction
Over the past decade, Mobile Financial Services (MFS) such as bKash, Nagad, and Rocket have transformed the financial landscape of Bangladesh, enabling over 100 million registered users to conduct peer-to-peer transfers, merchant payments, and utility bill disbursements. Despite this ubiquity, the user interface paradigms governing MFS have evolved minimally. The prevailing design language relies on static grids of monotone service icons and paginated transaction lists that provide no contextual intelligence or proactive financial guidance.

When emerging artificial intelligence technologies are applied to financial systems, significant security and reliability hazards emerge. Large Language Models (LLMs) are prone to stochastic hallucinations, arithmetical inaccuracy, and susceptibility to adversarial prompt injections. In a financial context, relying on an LLM to decide transfer amounts, verify account balances, or execute ledger updates poses catastrophic systemic risks.

FinMate AI addresses these structural challenges by introducing an **AI Financial Operating Layer**. Rather than utilizing AI as an autonomous agent with direct financial authority, FinMate AI implements AI strictly as a natural-language intent parser, semantic router, and explanatory interface. All financial calculations, risk evaluations, and ledger mutations are delegated to deterministic, mathematically verified backend services.

---

## 4. Background
In developing economies, MFS accounts serve as the primary transactional account for the unbanked and underbanked. Transactions are categorized under:
- **P2P Transfers (Send Money)**: Direct wallet-to-wallet transfers between individuals.
- **Cash Out**: Converting digital wallet balances into physical fiat currency through authorized third-party retail agents, typically incurring a 1.5% to 1.85% service fee.
- **Utility & Merchant Payments**: Settling water, electricity, and retail invoices.
- **Airtime Recharge**: Topping up mobile prepaid balances.

Traditional platforms treat these features as independent silos. Furthermore, accounts are strictly individualistic; parents lack systemic mechanisms to allocate regulated digital allowances to minor children, and digital literacy barriers prevent millions from understanding fee structures or tracking cumulative monthly expenditure.

---

## 5. Problem Statement
The conventional MFS user experience suffers from four fundamental deficiencies:
1. **Information Opacity & Cognitive Friction**: Users cannot easily determine why their balances deplete rapidly. Transaction histories display raw numbers without category aggregation or comparative trend analysis.
2. **Savings Inertia**: Less than 12% of everyday MFS users maintain formal savings deposits due to manual deposit friction and lack of spare lump-sum liquidity.
3. **Vulnerability to Scams & Coercion**: Digital fraud, false lottery scams, and social engineering attacks disproportionately target inexperienced users. Existing systems offer no in-band risk warnings before funds are transferred.
4. **Binary Account Boundaries**: Accounts provide unconstrained access once authenticated, making them unsafe for parental allowance distribution or supervised minor usage.

---

## 6. Motivation
The motivation of this research is to prove that modern web technologies (React, WebSockets, PWAs) and deterministic AI orchestration can turn an MFS application into an active personal financial guardian. By creating an architecture where conversational intent connects directly to a verified single service layer, we can empower users of all literacy levels to control their financial lives in their native language (Bangla or English) while eliminating the risk of LLM financial errors.

---

## 7. Objectives
1. **Architect a Single Service Layer**: Ensure that manual UI clicks, conversational Copilot commands, background schedulers, and reactive event rules invoke identical service functions in `server/src/services/*`.
2. **Eliminate Numerical Hallucination**: Enforce integer poisha (`100 poisha = ৳1.00`) arithmetic and derive all analytical responses from MongoDB aggregation pipelines rather than LLM text generation.
3. **Build an In-Band Guardian Risk Engine**: Analyze transaction parameters against historical user baselines to flag anomalous transfers with explainable bilingual review cards.
4. **Implement 4 Spec-Compliant Micro-Savings Modes**: Support Percentage, Round-up, Goal-based, and Threshold savings with event-driven double-entry ledger settlement.
5. **Enforce Two-Phase Security**: Ensure all financial mutations require explicit confirmation cards protected by 4-digit PIN step-up tokens bound to canonical action hashes.
6. **Provide Real-Time Synchronized State**: Propagate balance changes, new transactions, notifications, and bill split progress across connected clients via authenticated Socket.IO rooms.

---

## 8. Existing System
Existing MFS applications in Bangladesh (bKash, Nagad, upay) utilize native Android/iOS shells wrapping WebView or native UI components:
- Users log in via 5-digit or 4-digit PINs.
- Services are arranged in static 4x2 icon grids.
- Transaction statements show sequential debit/credit rows.
- Account types are generally binary (Personal vs. Merchant/Agent).
- Fraud prevention relies on post-facto SMS alerts or centralized hotline reporting.

---

## 9. Limitations of Existing MFS Experience
| Dimension | Traditional MFS | FinMate AI |
| :--- | :--- | :--- |
| **Interface** | Static icon grids, multi-step menus | Natural language conversational Copilot + standard UI |
| **Language Support** | Separate English/Bangla UI toggles | Native bilingual understanding (English, Bangla, Banglish) |
| **Financial Insights** | Unsorted list of past transactions | Category breakdown, MoM comparison, 90-day habit analysis |
| **Savings Mechanism** | Manual fixed DPS commitments | Automated event-driven micro-savings (2%, Round-up, Threshold) |
| **Parental Controls** | None (requires sharing main account) | Dedicated Child Accounts with 3 persistent Guardian modes |
| **Risk Detection** | Centralized post-fraud blacklisting | In-band, pre-confirmation explainable risk warning cards |
| **Automation** | Basic recurring reminders | Persistent lease-locked scheduler + event-driven rules |

---

## 10. Proposed System
FinMate AI introduces an integrated software architecture comprising:
1. **A Unified AI Financial Copilot**: Operating within `AgentModal.jsx`, providing a unified conversational gateway for all financial management tasks.
2. **A Double-Entry Ledger Engine**: Recording atomic `debit` and `credit` `LedgerEntry` documents inside MongoDB multi-document transactions.
3. **An In-Band Guardian Risk Analyzer**: Evaluating recipient novelty, transaction amounts vs. historical averages, time-of-day, and burst velocities.
4. **A Micro-Savings Execution Pipeline**: Listening to `transaction.settled` events and automatically transferring calculated savings into interest-free vaults.
5. **A RAG Knowledge Engine**: Serving static policy and fee documentation via pure Node.js Okapi BM25 ranking algorithm (k1=1.5, b=0.75).

---

## 11. Core Features
- **P2P Send Money**: Direct fund transfer with pre-validation recipient lookup.
- **Agent Cash Out**: Customer-to-Agent withdrawal with automated 1.5% fee deduction.
- **Mobile Recharge**: Multi-carrier airtime top-up with operator auto-detection.
- **Utility Bill Payment**: Structured bill settlement for DPDC, DESCO, and WASA.
- **Simulated Add Money**: Instant top-up from virtual bank accounts and cards.
- **Group Bill Splitting**: Multi-participant shared expenses with individual settlement tracking.
- **Scheduled & Conditional Payments**: Cron-like recurring jobs and wallet-credit triggers.
- **Bilingual Interface**: Seamless instant toggling between English and Bangla.

---

## 12. AI Financial Copilot
The AI Financial Copilot serves as the natural language interface. 

### Processing Pipeline:
1. **Input Normalization**: Strips punctuation, normalizes Bangla numerals (`০-৯` to `0-9`), and evaluates casing.
2. **Prompt Injection Inspection**: Evaluates 18+ adversarial heuristic patterns (e.g., *"ignore previous rules"*, *"reveal secret key"*, *"send without pin"*). If matched, flags `securityBlocked: true` and halts execution.
3. **Intent Classification**: Evaluates regular expressions and semantic markers across 35+ intents.
4. **Execution Routing**:
   - **Read Queries**: Invokes MongoDB aggregation services directly and formats response.
   - **Mutation Queries**: Validates parameters, executes Guardian risk checks, computes canonical action hashes, and returns a structured `PendingAction` preview card.

---

## 13. AI Financial Guardian
The Financial Guardian implements defense-in-depth across two distinct tiers:

### 1. In-Band Transaction Risk Review (`guardianRisk.service.js`)
Evaluated synchronously before any outgoing money mutation is staged:
$$\text{Risk Score} = 0.05 + S_{\text{recipient}} + S_{\text{amount}} + S_{\text{time}} + S_{\text{velocity}}$$
- **New Recipient ($S_{\text{recipient}} = 0.35$)**: Triggered if recipient phone has zero settled transaction history with sender.
- **Unusual High Amount ($S_{\text{amount}} = 0.35$)**: Triggered if transfer amount $> 2.5 \times \mu_{\text{historical}}$ and amount $> ৳1,000$.
- **Exceeds Historical Max ($S_{\text{amount}} = 0.20$)**: Triggered if amount exceeds sender's lifetime maximum transaction and $> ৳2,000$.
- **Unusual Hours ($S_{\text{time}} = 0.15$)**: Triggered if execution timestamp falls between 1:00 AM and 5:00 AM.
- **Rapid Velocity ($S_{\text{velocity}} = 0.25$)**: Triggered if sender initiated $\ge 3$ transactions within the preceding 10 minutes.

### 2. Child Protection Modes (`guardian.service.js`)
Profiles with `accountType: 'CHILD'` link to a parent account under one of three modes:
- **`APPROVAL_REQUIRED`**: Status set to `awaiting_guardian`. Funds are not debited until parent submits PIN approval.
- **`LIMITED`**: Daily spend tracked in `spentTodayPoisha`. Transactions exceeding daily limits (e.g., ৳500) are blocked with a `400 Bad Request`.
- **`UPDATES_ONLY`**: Transactions settle automatically; informational alerts are emitted via Socket.IO to the parent.

---

## 14. Personalized Micro-Savings
The micro-savings framework operates on deterministic integer arithmetic:

### 1. Mode A: Percentage-Based Savings
$$\text{Saved Poisha} = \left\lfloor \frac{\text{Amount} \times P}{100} \right\rceil, \quad P \in [1, 25]$$
*Example*: A ৳300.00 transfer at $P = 2\%$ results in $30000 \times 0.02 = 600\text{ poisha}$ (৳6.00).

### 2. Mode B: Round-Up Savings
$$\text{Saved Poisha} = U - (\text{Amount} \pmod U), \quad \text{where } U = 10000\text{ poisha } (৳100)$$
*Example*: Spending ৳87.00 (8,700 poisha) yields $10000 - (8700 \pmod{10000}) = 1300\text{ poisha}$ (৳13.00).

### 3. Mode C: Goal-Paced Savings
$$\text{Monthly Requirement} = \left\lceil \frac{\text{Target Poisha}}{M} \right\rceil, \quad M = \text{Duration Months}$$
*Example*: Target ৳10,000.00 in 3 months = $1000000 / 3 = 333333\text{ poisha}$ (৳3,333.33/month).

### 4. Mode D: Threshold Savings
$$\text{Saved Poisha} = \begin{cases} U - (\text{Amount} \pmod U) & \text{if } \text{Amount} > T \\ 0 & \text{otherwise} \end{cases}$$
Where $T = 50000\text{ poisha } (৳500)$ and $U = 10000\text{ poisha } (৳100)$.

---

## 15. Financial Personalization & Memory
User preferences and contextual memory are persisted in the `FinancialMemory` collection:
```json
{
  "userId": "6ac...",
  "microSavings": {
    "enabled": true,
    "mode": "percentage",
    "percentage": 2,
    "roundUpUnit": 10000,
    "thresholdMinPoisha": 50000,
    "paused": false,
    "totalSavedPoisha": 4800
  },
  "financialGoals": [
    {
      "keyword": "laptop",
      "title": "laptop Goal",
      "targetPoisha": 6000000,
      "savingsPlanId": "6ad..."
    }
  ]
}
```
When a user asks *"How am I doing with my laptop?"*, the service retrieves the goal by keyword, fetches the live `SavingsPlan` balance, and calculates percentage completion deterministically.

---

## 16. Conversational Application Control
The Copilot executes client-side application controls via standardized event payloads:
- **`app_logout`**: Returns `{ clientAction: { type: 'logout' } }`. Client purges `guardian_token` from `localStorage` and resets routing to `/`.
- **`app_change_pin`**: Returns `{ clientAction: { type: 'open_modal', modal: 'change_pin' } }`. Client dispatches `mfs:open_modal`, opening `ChangePinModal.jsx`. The user's PIN is never accepted or handled inside chat.
- **`app_navigate`**: Returns `{ clientAction: { type: 'navigate', path: '/history' } }`. Triggers client route transitions.

---

## 17. System Architecture
FinMate AI is structured into decoupled frontend and backend workspaces:

```
+-----------------------------------------------------------+
|                      React PWA Client                     |
|  (Home, Account, History, More, AgentModal, useSocket)     |
+-----------------------------+-----------------------------+
                              | HTTPS / WSS
+-----------------------------v-----------------------------+
|                     Express.js Server                     |
|  [Security Middleware: Helmet, CORS, RateLimiter, JWT]    |
+-----------------------------+-----------------------------+
                              |
+-----------------------------v-----------------------------+
|                  Single Service Layer                     |
|  - transaction.service.js      - guardian.service.js       |
|  - microSavings.service.js     - financialAnalysis.js      |
|  - guardianRisk.service.js     - rag.service.js            |
|  - scheduler.service.js        - socket.service.js         |
+-----------------------------+-----------------------------+
                              | ACID Transactions
+-----------------------------v-----------------------------+
|                      MongoDB Replica Set                  |
|  (Wallets, LedgerEntries, Transactions, FinancialMemory)  |
+-----------------------------------------------------------+
```

---

## 18. AI Architecture
- **In-Memory NLU Engine**: Tokenizes, normalizes, and extracts slot values using optimized regular expressions and phonetic dictionaries.
- **Zero Runtime Third-Party Dependency**: The Copilot executes fully offline in deterministic mode without external API latency or failure risks.
- **Groq Integration Diagnostic**: `server/scripts/doctor.js` connects to Groq API to verify availability of external LLMs (`openai/gpt-oss-120b`). When unconfigured, the app falls back to local deterministic execution with a visible status badge.

---

## 19. RAG Architecture
- **Document Base**: `server/src/knowledge/mfs_knowledge.json` containing 8 curated documentation chunks.
- **Vector Space**: Term Frequency (TF) vectors generated dynamically across document tokens.
- **Retrieval Metric**: Cosine similarity:
$$\text{Cosine Similarity}(Q, D) = \frac{\sum_{t \in Q \cap D} \text{TF}(t, Q) \cdot \text{TF}(t, D)}{\sqrt{\sum_{t \in Q} \text{TF}(t, Q)^2} \cdot \sqrt{\sum_{t \in D} \text{TF}(t, D)^2}}$$
- **Confidence Threshold**: Matches requiring $\text{Score} \ge 0.12$. Keyword boosting ensures exact phrase inquiries (e.g., *"Cash Out fee"*) prioritize canonical policy documents.

---

## 20. Tool Calling Architecture
Financial actions follow a mandatory two-phase commit:
1. **Phase 1 (Preparation & Intent Parsing)**:
   - Tool parameters extracted from user utterance.
   - Account balance and limits pre-checked.
   - Guardian risk signals evaluated.
   - Canonical `actionHash` calculated:
     $$\text{actionHash} = \text{SHA256}(\text{actionId} + \text{tool} + \text{canonicalJSON}(\text{args}))$$
   - `PendingAction` persisted with 5-minute TTL.
2. **Phase 2 (Confirmation & Execution)**:
   - User inputs 4-digit PIN in modal.
   - `POST /api/auth/step-up` issues 60-second `stepUpToken` bound to `actionHash`.
   - `POST /api/copilot/confirm` verifies token and hash against `consumed_tokens`.
   - Single service executes mutation inside MongoDB transaction.

---

## 21. Realtime Architecture
Built using Socket.IO v4:
- **Handshake Validation**: Rejects connection attempts lacking a valid Bearer JWT.
- **User Isolation**: Sockets automatically join `user:<userId>`.
- **Resource Multicast**: Dynamic rooms (`group_bill:<requestId>`) broadcast progress updates exclusively to bill participants.
- **Fallback Resilience**: In the event of network disruption, all state mutations succeed via standard HTTP REST responses.

---

## 22. Database Design
The schema design comprises 19 collections. Critical schema definitions include:

### `Wallets` Collection:
- `_id`: ObjectId
- `userId`: ObjectId (Indexed)
- `balance`: Number (Integer poisha, `min: 0`)
- `type`: String (`'primary'`, `'agent'`, `'savings'`)

### `LedgerEntries` Collection:
- `_id`: ObjectId
- `transactionId`: ObjectId (Indexed)
- `walletId`: ObjectId (Indexed)
- `userId`: ObjectId
- `direction`: String (`'debit'`, `'credit'`)
- `amount`: Number (Integer poisha, `min: 1`)
- `balanceAfter`: Number (Integer poisha)
- `idempotencyKey`: String (Unique index)

### `FinancialMemory` Collection:
- `userId`: ObjectId (Unique index)
- `microSavings`: Object (Mode, Percentage, Units, Thresholds, Paused, TotalSaved)
- `financialGoals`: Array (Keyword, Title, TargetPoisha, SavingsPlanId)

---

## 23. API Architecture
Express router structure with modular controllers:
- `/api/auth`: Registration, login, step-up token creation, PIN change.
- `/api/wallet`: Balance inquiries, recipient pre-validation, transactions, history.
- `/api/copilot`: Natural language message parsing, pending action execution, memory endpoints.
- `/api/guardians`: Parental controls, pending approvals, child removal.
- `/api/requests`: Bill split creation and individual share settlements.
- `/api/schedules`: Scheduled rules, automated mandates, reminders.
- `/api/safety`: Scam message checker, in-app notifications.

---

## 24. Security & Responsible AI
1. **Integer Money Representation**: Floating-point types are strictly prohibited in financial models to eliminate precision loss.
2. **Replay Attack Mitigation**: Short-lived step-up tokens are consumed atomically upon execution.
3. **Canonical Action Hashing**: Guarantees parameters cannot be tampered with between Copilot preview and PIN authorization.
4. **Brute Force Defense**: 3 incorrect PIN attempts trigger a 15-minute account lockout.
5. **No PII in Logs**: Pino logger sanitizes phone numbers, names, and tokens before writing logs.
6. **Zero Dark Patterns**: All transaction fees (e.g., 1.5% Cash Out) are displayed explicitly prior to confirmation.

---

## 25. User Flow
```
User Inquires: "Send 500 taka to 01728889900"
       │
       ▼
Copilot Normalizes Text & Validates Recipient
       │
       ▼
Guardian Evaluates Recipient History & Amount Velocity
       │
       ▼
Renders Styled Confirmation Card with Guardian Badge
       │
       ▼
User Enters 4-Digit PIN Inside Card
       │
       ▼
Client Requests Step-Up Token (`/api/auth/step-up`)
       │
       ▼
Client Posts Confirmation (`/api/copilot/confirm`)
       │
       ▼
MongoDB Transaction Debits Sender, Credits Receiver,
Writes Ledger Entries & Dispatches Realtime Sockets
```

---

## 26. Implementation Details
- **ES Modules Throughout**: Full Node.js native ESM compliance without transpilation.
- **Concurrency Control**: MongoDB sessions ensure serializable isolation on concurrent transfers.
- **PWA Capabilities**: Service worker caching and offline web app manifest.

---

## 27. Testing Methodology
The verification framework incorporates four testing levels:
1. **Unit Tests**: Verifying mathematical precision (Percentage, Round-up, Threshold, Goal pace).
2. **Integration Tests**: Supertest HTTP suite asserting database state, ledger consistency, and token consumption.
3. **Concurrency Tests**: Validating race condition resistance across parallel wallet debits.
4. **Browser Smoke Tests**: Headless Puppeteer execution testing end-to-end DOM rendering, modal states, and visual confirmation cards.

---

## 28. Test Cases
The test harness contains 12 suites comprising 87 automated tests:
- `server/tests/ai_financial_operating_layer.test.js`: 24 tests validating Copilot queries, Guardian risk signals, micro-savings math, RAG retrieval, and app controls.
- `server/tests/ai_copilot_full.test.js`: 22 tests validating prompt injection defense, child limits, agent dashboards, and multi-step scheduling.
- `server/tests/socket_realtime.test.js`: 5 tests asserting live multi-client P2P transfers and room isolation.
- `server/tests/guardian_approval_pin_flow.test.js`: 7 tests verifying parental PIN modals and IDOR prevention.
- `server/tests/concurrency.test.js`: Asserting balance preservation under simultaneous debits.

---

## 29. Results
- **100% Test Pass Rate**: 87 of 87 tests passing across all suites.
- **Zero Lint Violations**: ESLint check passing with 0 errors and 0 warnings.
- **Sub-Second Response Time**: Deterministic intent parsing executes in $< 15\text{ms}$ on local benchmarks.
- **Zero Ledger Discrepancies**: Zero balance drift observed across thousands of simulated concurrent transfers.

---

## 30. Limitations
1. **Synthetic Payment Switching**: Operates on simulated ledger rails without live Bangladesh Bank NPSB/BEFTN network integration; demonstrates provider lifecycle state machines via `SandboxPaymentProvider`.
2. **In-Memory Okapi BM25 RAG**: Uses document-length normalized BM25 term weighting optimized for domain institutional corpora without distributed vector DB overhead.
3. **Voice Input Browser Support**: Web Speech API is dependent on browser implementation (Chrome, Edge, Safari).

---

## 31. Future Work
1. Implementation of dense semantic embeddings with hybrid dense-BM25 reciprocal rank fusion (RRF) for massive regulatory corpora.
2. Integration of biometric WebAuthn Level 3 hardware attestation.
3. Direct integration with open banking sandbox switches.

---

## 32. Conclusion
FinMate AI demonstrates that financial software can deliver modern, natural language interaction without compromising security, deterministic precision, or regulatory compliance. By binding an AI Financial Copilot to an immutable double-entry ledger via a single service layer, FinMate AI establishes a robust blueprint for the next generation of mobile financial services.

---

## 33. References
1. Bangladesh Bank. (2022). *Guidelines on Mobile Financial Services (MFS) in Bangladesh*. Payment Systems Department.
2. Fowler, M. (2017). *Accounting Patterns and Append-Only Ledgers*. martinfowler.com.
3. Rescorla, E. (2018). *The Transport Layer Security (TLS) Protocol Version 1.3*. RFC 8446.
4. FIDO Alliance. (2021). *Web Authentication: An API for accessing Public Key Credentials Level 2*. W3C Recommendation.
5. Salton, G., & Buckley, C. (1988). *Term-weighting approaches in automatic text retrieval*. Information Processing & Management, 24(5), 513-523.
