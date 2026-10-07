# Architecture Decision Records (ADRs) - Guardian MFS

## Non-Negotiable Core Decisions
- **ADR-001: Integer Minor Units (Poisha)**: All currency calculations, storage, and transfers are conducted strictly in integer poisha (1 BDT = 100 poisha). Float arithmetic is strictly prohibited to prevent precision drift in financial records.
- **ADR-002: Append-Only Double-Entry Ledger**: Mutations to wallet balances execute paired debit/credit immutable `LedgerEntry` records inside MongoDB multi-document transactions with unique idempotency keys.
- **ADR-003: Single Service Layer ("Two Doors, One Brain")**: Express HTTP routes and the AI Agent tool executors invoke identical service functions in `server/src/services/*`. No business logic resides in routes or LLM prompts.
- **ADR-004: Two-Phase LLM Execution Boundary**: The LLM parses intent and emits tool calls. Destructive/money-moving actions create a `PendingAction` preview. Execution occurs only after the user approves via PIN/WebAuthn step-up token.
- **ADR-005: Zero-Config In-Memory DB Fallback**: If `MONGODB_URI` is blank in development, `mongodb-memory-server` spins up a single-node replica set so MongoDB transactions work out of the box with zero external dependencies.
- **ADR-006: Pure Node.js Safety Brain**: Logistic regression risk scoring and Naive Bayes scam detection run natively in Node.js to eliminate Python microservice dependencies.
- **ADR-007: Self-Hosted Offline Fonts**: `@fontsource/hind-siliguri` and `@fontsource/inter` bundle Bangla and Latin typography directly into the PWA assets for offline resilience.
- **ADR-008: Password/PIN Hashing**: `bcryptjs` is utilized as the default pure-JavaScript hasher for 4-digit PINs, ensuring seamless cross-platform execution on all developer operating systems without requiring C++ build toolchains.
- **ADR-009: Initial Demo Balance (৳10,000) via Auditable Ledger Transaction**: Every newly registered Customer and Agent receives ৳10,000 (1,000,000 poisha) demo balance through an auditable `initial_credit` transaction paired with an immutable `LedgerEntry` rather than arbitrary balance mutation.
- ADR-010: Explicit Account Types (CUSTOMER & AGENT) with Cash Out Settlement: Implemented distinct account models with an active Agent Directory. Cash Out executes a customer debit, 1.5% fee calculation, and agent wallet credit with real-time audit logging and an Agent Dashboard portal.
- ADR-011: Persistent Generic Scheduler & Reactive Event Rules: Built a lease-locked persistent scheduler polling every 5s for one-time, daily, weekly, and monthly jobs, paired with an event-driven `wallet.credit` conditional rule engine for automated bill pay and savings.
- ADR-012: LLM Number Validator & Fact Grounding: AiTips and copilot explanations validate all numbers extracted from text against structured ledger facts. If an ungrounded or hallucinated number is detected, the response is rejected and safely replaced with a deterministic template.
- **ADR-013: Child Accounts, Guardian Mode & Spending Policy Controls**: Supported `accountType: 'CHILD'` registration linked to a verified Parent account. Child profiles automatically inherit a `ProtectedProfile` with an enforced daily spending limit (default ৳500 / 50,000 poisha) and `requireApprovalForNewRecipients: true`. Transactions exceeding limits or initiating transfers to unapproved recipients transition into `awaiting_guardian` status without debiting funds. Settled atomically only after explicit Guardian T2 PIN step-up authorization, with strict authorization checks preventing IDOR and privilege escalation.
- **ADR-014: Seed-Free Zero-State Startup, Authoritative MongoDB Persistence & Real Auth/Lookup Flows**: Removed all automatic seeding of hardcoded demo accounts on application boot. MongoDB is the persistent single source of truth. Users create Customer, Agent, Parent, and Child accounts through the live registration UI/API with Confirm PIN validation. Implemented real-time recipient lookup (`/api/wallet/lookup-recipient/:phone`) and agent directory lookup (`/api/agents/lookup/:identifier`) rejecting invalid accounts with "Invalid account / Account not found" prior to PIN step-up. Integrated Web Speech API into the AI Copilot (`AgentModal.jsx`) for speech input piped into tool execution cards, and integrated manual automations UI (`ScheduledRulesModal.jsx`) for schedules, rules, and reminders backed by MongoDB.
- **ADR-015: Guest Mode Isolation, "Upay powered by AI" Wordmark, Dynamic MongoDB History & Notifications, Group Bill Share Settlements & 3 Persistent Guardian Control Modes**:
  1. *Guest Mode Isolation & Routing*: If the user is unauthenticated, all application financial services, navigation shell, headers, and modals are strictly hidden; the client mounts only `GuestAuthScreen.jsx` with Login and Registration. Protected route navigation redirects back to `/`.
  2. *Upay Branding*: Updated visual brand identity across client wordmark (`BrandMark.jsx`), `index.html`, PWA manifest, and i18n locales to "Upay powered by AI" without proprietary upay assets.
  3. *Dynamic MongoDB History & Notifications*: Removed all hardcoded mock arrays (`demoTransactions`). `History.jsx` dynamically queries `/api/wallet/history` with filters and real-time refresh. Added `/api/safety/notifications` with unread tracking and `NotificationsModal.jsx` wired to the header bell. Every transaction creates auditable MongoDB notifications.
  4. *Group Bill End-to-End Settlements*: Enabled both creator and participants to pay their shares with T2 PIN step-up tokens. Decrements remaining request obligations atomically, auto-closes upon complete fulfillment, and blocks duplicate payments.
  5. *3 Persistent Guardian Control Modes & Child Deactivation*: Added `controlMode` (`APPROVAL_REQUIRED`, `LIMITED`, `UPDATES_ONLY`) to `ProtectedProfile`. Enforced across service layer, manual UI, and AI Copilot. Added `removeChildRelationship` deactivating parent links (`status = 'inactive'`) while preserving the child's underlying MongoDB user account.
- **ADR-016: Socket.IO Realtime Synchronization Architecture**:
  1. *Complementary Realtime Layer*: Socket.IO provides low-latency bidirectional events strictly complementing authoritative REST endpoints. Does not bypass database transactions or ledger integrity. If WebSockets disconnect, all user actions seamlessly continue over REST.
  2. *Handshake Authentication & Private User Rooms*: Standard JWT access token verification on handshake assigns each client socket into isolated `user:<userId>` rooms. Public broadcast is prohibited for financial events.
  3. *Resource Rooms for Multi-Party Actions*: Dynamic `group_bill:<requestId>` rooms allow multi-client participants to receive live split progress as other members settle their shares.
  4. *Targeted Realtime Events*: `wallet:balance`, `transaction:new`, `notification:new`, `guardian:approval_request`, `guardian:approval_decided`, `group_bill:update`, and `savings:update` update client state instantaneously without requiring manual polling or full page reload.
  5. *Resource Leak & Reconnection Resilience*: Implemented singleton connection lifecycle manager (`client/src/services/socket.js`), unmount listener cleanup in `useSocket.js`, and exponential reconnection backoff.
- **ADR-017: AI Financial Operating Layer Architecture**:
  1. *Unified Operating Layer Inside Existing Copilot*: All financial assistant responsibilities (Guardian safety review, Financial advisory, Micro-savings, Transaction dispatch, Scam risk, and App control) live strictly inside the existing AI Copilot modal (`AgentModal.jsx` and `agentCopilot.service.js`). No fragmented side assistants or separate pages.
  2. *Strict Fact Grounding & Deterministic Calculations (Layer A)*: Balance, spending summaries, month-over-month comparisons, and habit explanations ("Why am I running out of money every month?") execute deterministic service math against MongoDB transactions (`financialAnalysis.service.js`). The LLM never hallucinates or invents financial figures.
  3. *In-Band Guardian Risk Signals & Review Cards (Layer B)*: Transactions evaluated with real data signals: unfamiliar recipients (`NEW_RECIPIENT`), historical average/max deviation (`UNUSUAL_HIGH_AMOUNT`), unusual hours (`UNUSUAL_TIME`), and rapid bursts (`RAPID_TRANSACTIONS`). Returns structured review cards with plain-language reasons without overblocking normal transactions.
  4. *Personalized Micro-Savings Engine (Layer C)*: Supports 4 explicit savings modes: Percentage (e.g. ৳300 * 2% = ৳6.00, ৳500 * 2% = ৳10.00), Round-up (e.g. ৳87 -> ৳100 = ৳13.00, ৳463 -> ৳500 = ৳37.00), Goal-based (e.g. ৳10,000 in 3 months = ~৳3,333/month pace), and Threshold (> ৳500 saves to next round figure). Automated deduction seamlessly executes via double-entry ledger transfers on settled transactions.
  5. *Persistent Financial Memory (Layer D)*: `FinancialMemory` model securely persists user savings rules, guardian alert preferences, and goals (e.g., "saving for a laptop") for authoritative natural language recall ("How am I doing with my laptop?").
  6. *RAG Documentation Pipeline*: Self-contained TF-IDF cosine similarity knowledge retrieval provides grounded explanations for official MFS documentation (Send vs Cash Out, Fee Schedules, Security Policies, Account Tiers). RAG is strictly restricted to static help docs and never touches live financial balances or transaction history.
  7. *Application Control Tools*: Natural language triggers real logout (`clientAction: { type: 'logout' }`), opens the secure `ChangePinModal` without exposing PIN in chat (`clientAction: { type: 'open_modal', modal: 'change_pin' }`), and navigates across the app.
  8. *Canonical Action Hashing & Anti-Replay Tokens*: High-risk mutations require canonical action hash verification matching T2 PIN step-up tokens before execution.
- **ADR-018: AI-Powered MFS Copilot Production Architecture Refactor**:
  1. *De-coupled Modular Subsystems (`server/src/services/copilot/*`)*: Separated agent logic into 10 dedicated single-responsibility engines: `inputNormalizer`, `toolRegistry` (47 tools cataloged across 12 categories), `taskStateManager` (multi-turn conversational memory, corrections, and cancellations), `entityResolver` (deterministic recipient & transliteration lookup), `ruleEngine` (business validations, fees, limits, and child policies), `confirmationManager` (canonical hashing & PendingAction generation), `intentPlanner` (security gates, LLM integration, and deterministic semantic planner), `auditLogger` (PII-scrubbed audit trail), `toolExecutor` (deterministic mutation execution after step-up auth), and `responseGenerator` (bilingual factual responses).
  2. *Strict LLM Boundary & Deterministic Settlement*: The LLM is strictly prohibited from mutating databases, approving limits, or deciding financial amounts. Mutations execute deterministically through MFS services via MongoDB multi-document transactions with T2 PIN step-up verification.
  3. *Semantic Natural Language & Multilingual Resiliency*: Complete removal of exact keyword checking. Intent is extracted semantically across Bangla, English, Banglish, and mixed queries, including natural speech corrections ("না, ৭০০ পাঠাও", "না, কানজিলকে পাঠাও") and cancellations ("না, বাতিল করো").
  4. *Deterministic Fallback & Offline Independence*: Works without Groq API keys (`AI: mock mode` badge), ensuring zero external dependency for end-to-end testing and local deployments.
- **ADR-019: Persistent Conversational & Long-Term Financial Memory Architecture**:
  1. *Two-Tier Memory Model*:
     - *Short-Term & Persistent Conversation History*: Multi-turn dialogue is persisted in MongoDB via `CopilotMessage` (with a 30-day TTL auto-expiry index), automatically restoring recent context across modal closes and re-opens, accompanied by privacy-compliant "Clear Chat" (`DELETE /api/copilot/history`).
     - *Long-Term Memory Subsystem (`FinancialMemory` & `memory.service.js`)*: Preserves contact aliases (bilingual kinship mapping: "brother", "bhai", "ভাই", "landlord"), utility bill accounts ("DESCO account 442109"), micro-savings preferences, financial goals, and personal context notes.
  2. *Contextual Injection & Zero-Friction Fulfillment*:
     - Recipient resolution automatically links remembered aliases ("Send 500 to my brother" -> immediately resolves recipient Rakib and prepares the step-up confirmation).
     - Utility payments auto-resolve saved meter/account numbers when omitted from prompts ("Pay DESCO bill 1200" -> automatically retrieves account `442109`).
  3. *Natural Language Memory Control*: Users can inspect ("What do you remember about me?"), record ("Remember that Karim is my brother"), remove ("Forget that Karim is my brother"), or clear ("Clear my memory") through conversational dialogue or dedicated REST APIs.
  4. *Visual Client Memory Drawer*: Added a dedicated "🧠 Memory" drawer toggle in `AgentModal.jsx` displaying known contact relationships, utility meters, and goals with instant deletion and direct manual entry.
  5. *Zero Credential Leakage*: Strict security boundaries prevent PINs, passwords, or authentication secrets from being recorded into conversational or long-term memory.

## Milestone Log

### M7: Guest Mode, Upay Branding, Dynamic History/Notifications, Group Bill Payments & 3 Guardian Control Modes
- Implemented `GuestAuthScreen.jsx` and guest gating in `App.jsx`.
- Updated placeholder wordmark to "Upay powered by AI" in `BrandMark.jsx`, `index.html`, and `vite.config.js`.
- Rewrote `History.jsx` to load all settled and pending transactions from MongoDB with AI tips and status tags.
- Created `NotificationsModal.jsx` and mounted `/api/safety/notifications` with mark-as-read support.
- Implemented group bill share payments in `request.service.js` and `RequestMoneyModal.jsx` with anti-duplicate enforcement.
- Implemented 3 Guardian control modes (`APPROVAL_REQUIRED`, `LIMITED`, `UPDATES_ONLY`) and `POST /api/guardians/children/:childId/remove` in `guardian.service.js`, `guardian.routes.js`, and `GuardianModal.jsx`.
- Verified 100% pass across all 21 Vitest tests, linting, build, targeted feature suite (`verify-targeted-features.js`), and 8 browser smoke flows.

## Dependency Justifications

### Server Dependencies
- `express`: Minimal, battle-tested web server framework for API endpoints.
- `mongoose`: MongoDB object modeling and multi-document transaction orchestration.
- `mongodb-memory-server`: Provides an embedded single-node replica set for zero-config offline/local development with transaction support.
- `zod`: Strict schema validation for environment variables, API payloads, and LLM tool outputs.
- `jsonwebtoken`: Standard implementation of short-lived JWT access and rotating refresh tokens.
- `bcryptjs`: Secure, pure-JavaScript implementation for 4-digit PIN hashing with zero native compile issues.
- `helmet`: Essential HTTP security headers middleware.
- `cors`: Secure cross-origin resource sharing configuration for client/server communication.
- `express-rate-limit`: Prevents brute-force attacks on authentication and financial endpoints.
- `pino`: Ultra-fast, low-overhead JSON structured logger with zero PII logging.
- `pino-pretty`: Human-readable console log formatting during development.
- `socket.io`: Real-time bidirectional event transport for instant guardian notifications and payment updates.
- `@simplewebauthn/server`: Official FIDO2/WebAuthn server library for platform biometric authentication.
- `web-push`: Push notification delivery using standard Web Push VAPID protocol.
- `multer`: In-memory multipart handling for document and bill photo uploads without disk persistence.
- `openai`: Official OpenAI-compatible client configured to interact with the Groq API base URL.
- `dotenv`: Loads local `.env` configuration into `process.env`.
- `vitest`: Lightning-fast, ESM-native testing framework.
- `supertest`: HTTP assertion testing for Express route endpoints.
- `puppeteer-core`: Automation tool for generating deterministic browser screenshots and end-to-end smoke verification using the existing local Chrome or Edge binary.

### Client Dependencies
- `react`: Declarative UI library for component composition.
- `react-dom`: DOM rendering for React.
- `vite`: Modern, fast frontend build tool and dev server with ESM support.
- `tailwindcss`: Utility-first CSS framework for clean styling, responsive layouts, and dark mode.
- `autoprefixer`: CSS vendor prefix postprocessor.
- `postcss`: CSS transformation engine for Tailwind.
- `react-icons`: Accessible, lightweight icons for upay-style UI navigation and grid tiles.
- `react-router-dom`: Client-side declarative routing and navigation.
- `i18next`: Internationalization engine supporting Bangla and English.
- `react-i18next`: React bindings for i18next translation hooks.
- `axios`: Promise-based HTTP client with interceptors for auth tokens and step-up headers.
- `socket.io-client`: Client-side WebSocket connection to the server for real-time notifications.
- `vite-plugin-pwa`: Zero-config PWA manifest and service worker generation.
- `@simplewebauthn/browser`: Browser WebAuthn client library for TouchID/FaceID passkey credentials.
- `zustand`: Lightweight, unopinionated state management for auth, wallet, and UI states.
- `@fontsource/hind-siliguri`: Self-hosted Bangla typography.
- `@fontsource/inter`: Self-hosted Latin and numerical typography.

## Milestone Log

### M0: Scaffold & Foundation
- Completed monorepo setup with npm workspaces (`client`, `server`).
- Configured `.env.example` and created `server/scripts/setup.js` for automatic secret generation (JWT access/refresh keys, VAPID public/private key pair).
- Built `server/scripts/doctor.js` with comprehensive checks for Node version, database connection & replica set transaction support, Groq API models & live capability tests, and deterministic mock mode fallback.
- Implemented MongoDB single-node in-memory replica set fallback (`MongoMemoryReplSet`) when `MONGODB_URI` is left blank, ensuring zero-config local development with full transaction support.
- Configured Tailwind CSS with custom brand tokens (`#FFD400`, `#0B4DA2`, dark surfaces) and integrated `@fontsource/hind-siliguri` and `@fontsource/inter`.
- Established i18n skeleton with 100% key parity between English and Bangla, verified via automated test.
- Built app shell with responsive centered 480px frame, upay-style yellow header in light mode, dark mode support, balance pill with 30s auto-hide, 4-column service grid, Safety & AI section, 5-tab bottom navigation with center elevated circular AI assistant button, and AI Agent copilot modal.
- Captured verified browser screenshots in light and dark mode.

### M1: Financial Ledger & ৳10,000 Initial Demo Balance
- Implemented double-entry append-only ledger (`LedgerEntry`) operating in integer poisha with MongoDB transactions and idempotency keys.
- Atomic user registration crediting exactly ৳10,000 (1,000,000 poisha) with matched ledger entry and audit log.
- Zero-negative balance invariant enforced at schema, service, and transaction level.

### M2: Send Money, Cash Out, & Agent Ecosystem
- Built Customer-to-Customer Send Money with transparent tiered fees (৳5 for > ৳1,000).
- Implemented Customer-to-Agent Cash Out with standard 1.5% fee, instant agent collection ledger credit, and live Agent Directory.
- Created dedicated Agent Dashboard showing today's collection volume, count, and real-time transaction stream.
- Step-Up authentication (T2) requirement enforced for all outgoing money movements.

### M3: Persistent Scheduler & Conditional Automation
- Implemented persistent database-backed scheduler with atomic lease-lock claims (`runningSince`, `lockedBy`) for one-time and recurring payments.
- Created event-driven `wallet.credit` trigger system for automatic conditional execution (e.g. pay utility bill or deposit to savings when salary is credited).
- Enforced mandate caps and balance validations before automated execution.

### M4: AI Agent Copilot & Security Boundary
- Implemented multi-intent natural language classifier distinguishing Immediate, Scheduled, Recurring, Conditional, and Reminder requests.
- Blocked prompt injection attacks and confidential data leaks (PIN, full NID).
- Fact-grounded AI feedback (`AiTip`) with strict regex Number Validator ensuring 100% parity between generated advice and ledger facts.

### M5: Child Accounts, Guardian Approval Flow & Security Hardening
- Added explicit `CHILD` account type registration with parent mobile verification and custom daily spending limit (`dailyLimitPoisha`).
- Auto-seeded demo child account Abir (`01799887766`) linked to Rakib (`01711112222`) with ৳500 limit.
- Updated `sendMoney` and `cashOut` service layer to check `evaluateGuardianPolicy` and hold transactions (`status: 'awaiting_guardian'`) without debiting child funds.
- Added `GET /api/guardians/pending-approvals` and `POST /api/guardians/approvals/:txnId/decide` with T2 PIN step-up.
- Added anti-IDOR authorization checks: non-guardians and the child cannot approve or reject approvals.
- Built interactive pending approval cards in `GuardianModal.jsx` and updated `AuthModal.jsx` with 1-click child switcher.
- Wrote and passed comprehensive test suite `parent_child_and_security.test.js` (6 new tests, 21 tests total passing).
### M8: AI Copilot Complete Audit, Repair & Full Functionality Integration
- Audited and repaired entire Copilot pipeline ensuring 100% parity with the single backend service layer.
- Added instant read-tool queries for:
  - Wallet balance (`Wallet.findOne({ userId })`) with child daily remaining limit notice.
  - Account information, limits, and profile.
  - Real transaction history and transaction breakdown (last transaction details).
  - Real MongoDB notifications and unread counts.
  - Reminders query and one-click cancellation.
  - Schedules query and cancellation.
  - Rules query and toggle.
  - Group bill & money requests status (paid vs owed amounts).
  - Guardian status & child spending limits.
  - Agent dashboard analytics (volume, collections, customer transactions).
- Added multi-intent and money-moving PendingActions with Tier 2 step-up PIN confirmation:
  - `send_money` (with first-time transaction warning and scam check).
  - `cash_out` (with agent lookup and 1.5% fee calculation).
  - `add_money` / `cash_in`.
  - `mobile_recharge` (with telecom operator detection).
  - `pay_bill` (DPDC, DESCO, WASA, Titas, Carnival).
  - `create_schedule` (one-time and recurring with companion reminder support).
  - `create_rule` (conditional triggers).
  - `guardian_decision` (approval/rejection of child transactions).
- Security Boundary & Auditability:
  - Blocked all prompt injection vectors ("ignore all rules", "disable guardian", "send all my money", "without pin", "reveal system prompt", "give me another user balance").
  - Prevented IDOR / cross-user data leakage.
  - AuditLog entries recorded for all Copilot executions.
- Updated UI title to `AI Copilot` in `AgentModal.jsx` and added quick suggestion chips.
- Added comprehensive Vitest suite `server/tests/ai_copilot_full.test.js` (22 tests passing, 43 total tests passing).

### M9: Child Mode UI Controls, Header & Account Parent Info, and Overhauled Group Bill Form
- **Child Account — Hide Guardian Mode**:
  - In `client/src/pages/Home.jsx`, conditionally excluded `guardian` from `safetyItems` when `user.accountType === 'CHILD'`.
  - In `client/src/App.jsx`, guarded `handleSelectSafety('guardian')` from opening the modal if `user.accountType === 'CHILD'`.
  - Preserved 100% of backend guardian policies, approval queues, and spending limits.
- **Removed Duplicate AI Copilot Entry Point**:
  - Removed duplicate `aiAssistant` card from the "Safety / AI Guardian" grid in `Home.jsx`.
  - Preserved the bottom-navbar AI Copilot button as the primary access point.
- **Child Mode — Parent/Guardian Information in Header & Account**:
  - Enriched `login`, `quickSwitchUser`, and `GET /api/auth/me` with populated `sanitizedUser.guardian = { name, phone, controlMode, dailyLimitPoisha, status }` for `CHILD` accounts from `ProtectedProfile`.
  - In `client/src/components/layout/Header.jsx`, rendered `Under Guardian: ${parentName} (${parentPhone})` / `অভিভাবকের অধীনে: ...` above child name.
  - In `client/src/pages/Account.jsx`, added a dedicated "Guardian Protection & Controls" card detailing Parent name, phone, protection status, control mode, and daily limit in ৳.
- **Overhauled Group Bill (`RequestMoneyModal.jsx`)**:
  - Positioned "Where will the payment go? (কোথায় টাকা যাবে?)" at the very top of the modal with 3 target categories: Merchant, Agent, Person.
  - Destination number input with live MongoDB verification badge via `/api/wallet/lookup-recipient/:phone`.
  - Dynamic individual member rows (Member 1, Member 2...) with working `+ Add More` and delete buttons (no comma-separated text input).
  - Live recipient validation badges on every member row.
  - 3 functional split modes: Equal, Percentage (100% sum validation), Fixed Amount (total amount match validation).
  - Real-time contribution breakdown preview showing individual shares and destination.
  - Fully bilingual (Bangla and English) and responsive in dark/light mode.
- **Group Bill Modal Scrollbar UI Fix**:
  - Hidden visible scrollbar/track inside the Group Bill modal body using browser-compatible scrollbar hiding (`no-scrollbar`, `[scrollbar-width:none]`, `[-ms-overflow-style:none]`, and `[&::-webkit-scrollbar]:hidden`).
  - Preserved complete scrollability via mouse wheel, trackpad, touch, and keyboard.
- **Verification & Testing**:
  - Verified with automated Puppeteer script `server/scripts/verify-child-and-groupbill.js` capturing screenshots.
### M10: Header Cleanup, More Page PIN Management & Agent Portal Removal, Dynamic Linked Accounts, and Dynamic Custom Savings & DPS
- **Header Cleanup**:
  - Removed "AI: Live" badge/status indicator from `Header.jsx`.
  - Removed the `Switch / Logout` header buttons; all user switching and logout operations are centralized inside `More.jsx`.
  - Removed the "Guardian" badge located under the header; guardian status and parent information are exclusively located within `Account.jsx`.
- **Change PIN in More Page**:
  - Implemented `POST /api/auth/change-pin` in `auth.routes.js` and `changePin` in `auth.service.js`.
  - Validates current PIN via `bcrypt.compare`, validates 4-digit numeric format on new PIN and confirm PIN, hashes new PIN with bcrypt, updates user document, generates an auditable `AuditLog` entry (`PIN_CHANGE`), and triggers a security notification.
  - Built `ChangePinModal.jsx` integrated directly into the `More.jsx` security settings.
- **Agent Portal Removal from More Page**:
  - Removed the "Agent Portal" item from `More.jsx` settings list while retaining all underlying agent service logic, models, and API routes.
- **Dynamic Linked Accounts**:
  - Created `LinkedAccount` MongoDB schema and model (`server/src/models/LinkedAccount.js`).
  - Implemented `GET /api/wallet/linked-accounts`, `POST /api/wallet/linked-accounts`, and `DELETE /api/wallet/linked-accounts/:id` in `transaction.routes.js`.
  - Replaced static card in `Account.jsx` with dynamic linked accounts list, real-time "+ Add Linked Account" form with validation, and delete/unlink actions.
- **Dynamic Custom Savings & DPS Schemes**:
  - Created `SavingsPlan` MongoDB schema and model (`server/src/models/SavingsPlan.js`).
  - Implemented `GET /api/wallet/savings-plans`, `POST /api/wallet/savings-plans`, and `POST /api/wallet/savings-plans/:id/deposit`.
  - Overhauled `SavingsModal.jsx` to feature dynamic Savings Goals and DPS Schemes tabs, interactive custom configuration forms (title, target/installment, tenure, interest rate, auto-debit), progress bars, and live deposit execution with wallet balance deduction.
- **Account Page Actions Removal**:
  - Removed the "Account Actions" card (`অ্যাকাউন্ট নিয়ন্ত্রণ`) from `Account.jsx`, keeping Switch and Logout actions solely in `More.jsx`.
- **Verification & Testing**:
  - Comprehensive automated end-to-end verification script `server/scripts/verify-all-8-changes.js` passed all 8 items with 100% success.
  - Vitest test suite: 43 / 43 tests passing.
  - ESLint: 0 errors, 0 warnings.
  - Vite build: successful clean build.

### M11: Schedule & Rule Canonical Step-Up Authorization, Anti-Replay Token Consumption, and Change PIN Modal Polish
- **Canonical Action Hash & Step-Up Parity**:
  - Identified root cause of `Step-up authorization failed: Step-up token action hash mismatch`: Client generated ad-hoc `actionHash: sched-${Date.now()}` on step-up and re-evaluated `Date.now()` during creation, producing mismatched timestamps.
  - Implemented `computeCanonicalActionHash({ actionId, actionType, tool, payload, args })` using deterministic JSON serialization and SHA-256 in `auth.service.js`.
  - Added indexed `actionHash` field and pre-save fallback to `PendingAction` schema (`server/src/models/PendingAction.js`).
  - Added prepare endpoints for both Scheduled actions and Conditional Rules:
    - `POST /api/schedules/prepare`: Resolves schedule parameters (`nextRunAt`, `mandate`), creates `PendingAction`, computes canonical `actionHash`, and returns `pendingAction` object.
    - `POST /api/schedules/rules/prepare`: Creates `PendingAction` with rule action details and canonical `actionHash`.
  - Updated `requireTier('T2')` middleware (`server/src/middleware/auth.js`) to dynamically look up `PendingAction` when `actionId` is supplied in the request body, extract its canonical `actionHash`, and enforce strict parity against the decoded step-up token.
- **Anti-Replay Token Consumption**:
  - Implemented `ConsumedToken` schema (`server/src/models/ConsumedToken.js`) with SHA-256 token hash indexing and a 5-minute MongoDB TTL index for automatic pruning.
  - Added dual in-memory and MongoDB persistence checks in `isStepUpTokenConsumed(token)` and `consumeStepUpToken(token)` (`server/src/services/auth.service.js`).
  - Step-up tokens now include unique `jti: crypto.randomUUID()` UUIDs.
  - `POST /api/schedules/confirm`, `POST /api/schedules/rules/confirm`, and `POST /api/ai/confirm` strictly consume the step-up token upon successful state mutation, preventing replay attacks.
- **Change PIN Modal Visual & Layout Polish**:
  - Removed unwanted 10px-20px dark gap/strip above the Change PIN modal: In `More.jsx`, the modal was rendered inside a `div.space-y-5` container which applied `margin-top: 1.25rem` (20px) to all direct children; moved `<ChangePinModal />` outside the `space-y-5` container and styled overlay with `!m-0 !mt-0`.
  - Locked `document.body.style.overflow = 'hidden'` while `ChangePinModal` is open to eliminate background page window scrollbars.
  - Hidden visible scrollbar on modal card while maintaining full touch, wheel, and trackpad scrolling via `no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`.
- **Verification & Testing**:
  - Added dedicated integration test suite `server/tests/schedule_rule_stepup_security.test.js` (7 security tests covering canonical hash parity, incorrect PIN, tampered hash, expired tokens, reused tokens, and double confirmation).
  - Vitest test suite: 50 / 50 tests passing (100%).
  - ESLint: 0 errors, 0 warnings.
  - End-to-end browser smoke test `server/scripts/verify-fixes-browser.js` verified all 4 items in Chrome.

### M12: Fixed Header, Universal Scrollbar Hiding & Two-Line AI Copilot Dummy Prompts Layout
- **Fixed / Sticky Header**:
  - Implemented `sticky top-0 z-40 w-full` on `<Header>` and updated `FrameWrapper.jsx` to `overflow-x-clip` so that the header remains visible and pinned at the top while scrolling without breaking sticky positioning or clipping child layers.
  - In-flow sticky positioning ensures the underlying page content starts naturally immediately below the header without being hidden or overlapping. Preserved `rounded-b-3xl`, `shadow-soft`, spacing, and centered alignment on both mobile and desktop.
- **Cross-Browser Scrollbar Hiding**:
  - Enhanced `.no-scrollbar` in `index.css` with `::-webkit-scrollbar { display: none !important; }`, `-ms-overflow-style: none !important;`, and `scrollbar-width: none !important;` for Chrome, Edge, Safari, and Firefox.
  - Applied hidden scrollbar classes and inline styles to More page, History page, History filter & side-scroll containers, AI Agent screen modal and message thread (both vertical and horizontal), and AI Copilot / Agent Portal modal.
  - Ensured scrolling remains fully functional via mouse wheel, trackpad, touch, and keyboard.
- **AI Copilot Dummy Prompts Two-Line Layout**:
  - Restructured quick suggestion chips in `AgentModal.jsx` into two distinct rows (`flex flex-col gap-1.5` with two `overflow-x-auto no-scrollbar` rows of 3 buttons each) instead of a crowded single line.
  - Preserved all prompt text, multilingual strings, click handlers, and functionality.
- **Verification & Testing**:
  - Automated browser verification script `server/scripts/verify-ui-fixes.js` passed all checks in Chrome with screenshots captured in artifact and doc dirs.
  - ESLint passed with 0 errors, 0 warnings.

### M13: Filled RGB Iconography Upgrade Across All Features, Services, and Modals
- **Flaticon-Style Filled RGB Icon Suite**:
  - Created `client/src/components/ui/FlaticonIcons.jsx` exporting 27 custom filled RGB SVG icons with clean dark outlines, vibrant multi-tone color fills, and highlights matching the user's reference design (`media_1791021867488.png`).
  - Icons designed with `viewBox="0 0 48 48"` and scalable SVG geometry that renders crisply in both light and dark themes.
- **Strict Scope Boundaries**:
  - Maintained outline icons in `Header.jsx` and `BottomNav.jsx` without modification, strictly respecting the user constraint ("navbar ar header bad e").
  - Replaced monotone outline icons across all other pages and modals:
    - `Home.jsx`: Financial services grid (Send Money, Recharge, Cash Out, Pay Bill, Add Money, Savings, Request Money) and Safety & AI Guardian grid (Guardian Mode, Check Message, Reminders, Scheduled & Rules, Group Bill).
    - `More.jsx`: All 9 menu list items (Change PIN, Language, Theme, Biometric Auth, Switch Account, Profile, KYC, Logout, FAQ).
    - `Account.jsx`: Savings Wallet, Limits & Usage speedometer, and Linked Accounts vault.
    - `History.jsx`: Directional transaction indicators and empty state icon.
    - `GuestAuthScreen.jsx`: Language, theme toggles, and role selection cards.
    - `AgentModal.jsx`: Modal header robot avatar and AI chat message bubbles.
    - Modals: `SendMoneyModal.jsx`, `CashOutModal.jsx`, `PayBillModal.jsx`, `RechargeModal.jsx`, `AddMoneyModal.jsx`, `SavingsModal.jsx`, `RequestMoneyModal.jsx`, `GuardianModal.jsx`, `GuardianApprovalModal.jsx`, `CheckMessageModal.jsx`, `ScheduledRulesModal.jsx`, `ChangePinModal.jsx`, `AgentDashboardModal.jsx`, `NotificationsModal.jsx`, `AuthModal.jsx`.
- **Zero Business Logic Disruption & 100% Test Parity**:
  - Fully preserved all financial rules, integer poisha math, single service layer contracts, LLM boundary protections, and anti-replay step-up token security.
  - Fixed test assertion alignment in `server/tests/guardian_approval_pin_flow.test.js`.
  - All 10 Vitest test suites (58 / 58 tests) passing 100%.
  - ESLint: 0 errors, 0 warnings.
  - Vite build: successful clean build (2.49s).
  - Browser verification script (`server/scripts/verify-rgb-icons.js`) executed and captured high-resolution verification screenshots.

### M14: Socket.IO Realtime Ecosystem (Balance, Transactions, Notifications, Guardian & Split Bills)
- **Backend Architecture & Service Integration**:
  - Built `server/src/services/socket.service.js` with handshake JWT authentication, `user:<userId>` room isolation, and resource rooms (`group_bill:<requestId>`).
  - Integrated realtime socket dispatches into core single-service mutations (`transaction.service.js`, `guardian.service.js`, `request.service.js`, and `transaction.routes.js`).
  - Guaranteed transactional atomicity: Socket events emit strictly after MongoDB transaction commits.
- **Frontend Realtime Hooks & UI State Reactive Updates**:
  - Built singleton socket manager `client/src/services/socket.js` handling dynamic port detection, JWT passing, and auto-reconnect.
  - Built `client/src/hooks/useSocket.js` updating global Zustand stores (`authStore` for wallet balance, `systemStore` for notification counts) and emitting custom events for decoupled UI listening.
  - Wired live reactive UI updates to `History.jsx` (prepends incoming transactions live), `NotificationsModal.jsx` (live notification updates), `GuardianModal.jsx` (live approval requests and decisions), `RequestMoneyModal.jsx` (multi-user group bill split progress), and `SavingsModal.jsx` (live plan balances).
- **Multi-Client Verification & Testing**:
  - Created 5 multi-client Vitest integration tests in `server/tests/socket_realtime.test.js` covering handshake rejection, live P2P transfer, child -> parent guardian approval, group bill progress, and disconnect/reconnect resilience.
  - Automated Puppeteer browser smoke test `server/scripts/verify-realtime-browser.js` verified multi-client live transfer between User A and User B with zero page refresh, capturing before/after screenshots (`realtime-user-b-before.png` and `realtime-user-b-after.png`).
  - Vitest test suite: 11 test suites, 63 / 63 tests passing 100%.
  - ESLint: 0 errors, 0 warnings.

### M15: AI Financial Operating Layer (Unified Copilot, Guardian Risk Review, Micro-Savings & RAG)
- **Backend Architecture & Services**:
  - Implemented `server/src/models/FinancialMemory.js` for persistent micro-savings rules, guardian alerts, and financial goals.
  - Implemented `server/src/knowledge/mfs_knowledge.json` and `server/src/services/rag.service.js` for self-contained, prompt-injection-safe documentation retrieval.
  - Built `server/src/services/financialAnalysis.service.js` for deterministic spending breakdowns, income analysis, month-over-month comparisons, and habits explanations.
  - Built `server/src/services/microSavings.service.js` implementing all 4 spec savings modes (Percentage, Round-up, Goal-based, Threshold) and automated double-entry ledger settlement on outgoing transactions via event bus.
  - Built `server/src/services/guardianRisk.service.js` evaluating explainable risk signals (unfamiliar recipient, abnormal transaction amounts vs history, rapid transactions).
  - Upgraded `server/src/services/agentCopilot.service.js` into full operating layer with clarification prompts, app control tools, canonical action hashing, and T2 step-up verification.
  - Added `/api/copilot/memory` and `/api/copilot/savings/configure` in `server/src/routes/agentAi.routes.js`.
- **Frontend Upgrades**:
  - Integrated `AgentModal.jsx` with Guardian review risk cards, inline micro-savings progress cards, spending comparison cards, app control listeners, and two-line quick prompt layout.
  - Connected `ChangePinModal` to global `mfs:open_modal` event in `App.jsx` ensuring PINs never enter chat context.
- **Verification & Testing**:
  - Built 24 comprehensive integration tests in `server/tests/ai_financial_operating_layer.test.js` covering Section 54 math, Guardian risk signals, Copilot queries, Micro-savings & memory, RAG pipeline, App control actions, and step-up confirmation execution.
  - Full test suite: 12 test files, 87 / 87 tests passing 100%.
  - Lint: 0 errors, 0 warnings.
  - Client production build: successful (2.82s).
  - Executed automated Puppeteer smoke test `server/scripts/verify-copilot-operating-layer.js` verifying balance checks, financial habits analysis, 2% micro-savings configuration, RAG document retrieval, and Guardian step-up confirmation cards with screenshots saved.

### M16: Manual Savings Customization UI, Safe Goal Management & AI Financial Copilot Hardening
- **Manual Savings Customization UI (`SavingsModal.jsx`)**:
  - Added full standalone configuration controls directly in the Savings UI:
    - Auto Micro-Savings tab alongside Savings Goals and DPS schemes.
    - Master toggle to enable/disable micro-savings and pause/resume buttons with active status badges.
    - Percentage-based micro-savings slider and preset chips (1%, 2%, 5%, 10%, 15%, and custom 1% to 25%).
    - Round-Up unit radio options (nearest ৳10, ৳50, ৳100).
    - Threshold-based savings option with configurable minimum spend amount.
    - Interactive target savings goal linkage dropdown, binding micro-savings deposits to an active goal.
    - Dynamic calculation preview card showing real-time deducted savings on custom sample transaction amounts (e.g. ৳500 spending -> ৳10 / 2% saved).
    - Goal lifecycle management: Edit existing plan (title, target amount, duration) via `PATCH /api/wallet/savings-plans/:id` and safe cancellation via `DELETE /api/wallet/savings-plans/:id` which atomically refunds accumulated balances back to the primary wallet with a ledger entry.
- **Unified Single Source of Truth**:
  - Both manual UI and AI Copilot read and write to the same `FinancialMemory` and `SavingsPlan` collections via `microSavings.service.js` and `transaction.routes.js`.
  - Config changes emit `'savings:config'` via Socket.IO, updating open browser instances in real time.
- **AI Financial Copilot Hardening (`agentCopilot.service.js`)**:
  - Ambiguous / Incomplete Intent Handling:
    - Recipient without amount: prompts user to provide transaction amount before creating `PendingAction`.
    - Amount without recipient: prompts user to specify recipient phone number before creating `PendingAction`.
    - Clarification questions with actionable examples for vague inputs ("Change my savings", "Remind me later", "Save more", "Pay").
  - Strict Boundary & Invalid Input Checks:
    - Rejects negative and zero amounts without creating `PendingAction`.
    - Enforces 1% to 25% boundary on percentage savings and non-negative target amounts.
    - Rejects past reminder scheduling.
    - Rejects self-transfers (sending money to oneself).
    - Rejects transactions exceeding single-transaction limits (৳25,000).
  - Security, Privacy & Secret Protection Gates:
    - Secret Probing: Refuses all queries asking for PIN, OTP, or password credentials.
    - Privacy Barriers: Strictly blocks queries attempting to access other users' balances, transactions, or account profiles.
    - Adversarial Prompt Injections: Blocks jailbreak instructions attempting to bypass confirmation, bypass PIN, or override policy.
  - Conflict Detection & Multi-Intent Parsing:
    - Detects and halts conflicting simultaneous commands (e.g. enable + disable, pause + resume, send + cancel).
    - Safely parses independent multi-intent clauses joined by "and" / "এবং".
  - Banglish & Multilingual Understanding:
    - Robust handling of natural Banglish expressions ("amar balance koto", "savings bondho koro", "taka pathate chai").
- **Verification & Testing**:
  - 31 new comprehensive tests in `server/tests/savings_and_copilot_hardening.test.js`.
  - Full test suite: 13 test files, 118 / 118 tests passing 100%.
  - Vite client production build: clean build (2.92s).

### M17: Conversational Financial AI Agent Upgrade (Natural Intent Parsing, Multi-Action Grounding & Zero Hallucination)
- **ADR-018: Conversational Financial Agent Operating System**:
  - **Natural Language Intent Recognition**: Upgraded the AI Financial Copilot beyond rigid button templates and command syntax. The agent natively parses natural requests across English, Bangla, and Banglish:
    - *Money Transfer*: "Rahim ke 500 taka pathao", "017xxxxxxxx e 1000 send koro", "amar friend ke 200 taka dao". Validates recipient in database before execution. Rejects unknown recipients with truthful error ("এই নম্বর/অ্যাকাউন্টটি পাওয়া যায়নি, তাই transfer করা সম্ভব হচ্ছে না") without pretending success. Pre-validates wallet balance against transaction amount and fees, returning clear insufficient balance errors.
    - *Cash Out*: "Cash out 2000", "2000 taka cashout koro", "Agent Kabir er kache 1500 taka cashout koro". Automatically locates registered Agent accounts, computes mandatory 1.5% fee (৳15 per ৳1,000) using integer poisha math, checks available balance against total (amount + fee), and prepares pending action summary.
    - *Bill Payment*: "Pay my electricity bill", "DESCO bill 1200 taka dao", "Titas gas bill পরিশোধ করো". Identifies provider (DESCO, DPDC, BTCL, TITAS, NESCO), elicits missing amounts gracefully, checks available balance, and prepares step-up payment card.
    - *Group Bill*: "Create a 2000 taka group bill for dinner with Rahim, Karim and Nabila". Naturally extracts bill description, resolves participant phone numbers from database, computes integer equal split shares including creator, detects vague statements ("with 3 people" -> prompts for participant names/numbers), and presents preview card before creating `MoneyRequest` in MongoDB.
    - *Savings Plans*: "I want to save 5000 taka in the next 2 months", "Make a savings plan for my new laptop". Intelligently prompts for target amount when missing, computes monthly saving pace, and activates real `SavingsPlan` and `FinancialMemory` records.
    - *Guardian Mode Approvals*: "Approve my child's 300 taka payment", "আমার সন্তানের পেমেন্ট অ্যাপ্রুভ করো". Truthfully reports when no pending child transactions exist, matches pending held transactions by amount and child identity, presents confirmation card, and settles transaction upon guardian T2 PIN step-up.
    - *Scope Enforcing / Irrelevant Query Refusal*: Politely declines non-financial queries (weather, coding, jokes, trivia, recipes) in both Bangla and English while explaining UPAY's dedicated financial capabilities.
  - **Security, Ledger & Step-Up Auth Non-Negotiables**:
    - All money mutations use integer minor units (poisha).
    - Money-moving actions create a canonical `PendingAction` and require valid 4-digit PIN step-up verification before execution.
    - Execution returns actual backend transaction receipts and detail messages; zero fabricated or hallucinated transaction results.
- **Verification & Testing**:
  - 21 comprehensive integration tests in `server/tests/ai_copilot_conversational.test.js`.
  - Full backend test suite: 15 test suites, 143 / 143 tests passing 100%.
  - Frontend production build: clean Vite build (9.84s).

### M18: Specialized Domain Agents Architecture & Conversational State Orchestration
- **Specialized Domain Agents (`server/src/services/copilot/domainAgents/`)**:
  - `domainRouter.js`: Central orchestrator receiving structured context `{ userId, messageText, language, user, wallet, taskState, intent }` and routing to domain agents based on semantic intent and active task state.
  - `savingsAgent.js`: Complete autonomous handling of all manual savings capabilities via natural language (no naive text matching):
    - Micro-savings configuration: percentage auto-save (1% to 25% boundary validation, negative rejection), round-up auto-save toggle.
    - Lifecycle controls: pause, resume, and disable micro-savings.
    - Goal-based savings: goal creation with purpose extraction (stop-word resilient, e.g. "for my new laptop"), dynamic duration extraction, pace recommendation calculation (`calculateGoalPace`), goal target updates, and progress queries ("How am I doing with my Laptop?").
    - Direct savings deposit: integer poisha validation, balance pre-check, and `PendingAction` creation with Tier 2 step-up PIN verification.
    - Settings and status query: retrieves real MongoDB config and active plans.
  - `guardianAgent.js`: Child account onboarding, limit updates, typo-tolerant parsing (e.g. `gchildren`, `liimit`), multi-turn slot filling (prompting for missing phone number or limit), and pending approval queue checks.
  - `groupBillAgent.js`: Bill splitting, equal and custom share calculation, contact resolution, participant validation, and prefilling the `group_bill` modal.
  - `scheduleRuleAgent.js`: Autonomous scheduling, conditional rules ("when money comes save 500"), and smart reminders with companion scheduling.
- **Resilient Multi-Turn & Partial Inputs Handling**:
  - State machine maintains conversational task state (`taskState`) across turns, recognizing follow-up inputs ("01774474900", "500", "Grameenphone") within the active workflow without resetting context.
- **Verification & Testing**:
  - 14 specialized domain agent tests in `server/tests/ai_copilot_domain_agents.test.js`.
  - Full test suite: 20 test files, 183 / 183 tests passing 100%.
  - Production Vite build: passes cleanly.

