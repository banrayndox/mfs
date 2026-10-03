# FinMate AI / Guardian MFS: UI Screenshot Plan

This document establishes the official visual evidence plan for the FinMate AI (Guardian MFS) academic report, presentation deck, and technical evaluation. Every screenshot corresponds strictly to **implemented and verified user interface states** in the codebase (`client/src/`).

---

## 1. Executive Visual Inventory

The screenshot capture plan ensures that evaluators, judges, and auditors can verify every tier of the application:
1. **PWA Mobile-First Experience & Ergonomics** (Tailwind CSS, Hind Siliguri / Inter typography, dark/light themes, bilingual toggle).
2. **AI Financial Copilot Layer** (`CopilotModal.jsx`, deterministic rule-based tool orchestration, RAG answers, two-line suggestion chips).
3. **AI Financial Guardian Security Architecture** (`guardianRisk.service.js`, risk banners, two-step PendingAction confirmation cards).
4. **Autonomous Micro-Savings Engine** (`savingsRule.service.js`, round-up, percentage, threshold, goal pacing).
5. **Realtime Socket.IO State Synchronization** (`socket.service.js`, instant multi-client wallet updates without browser reload).
6. **Double-Entry Financial Auditing & History** (`history.jsx`, transaction filtering, immutable ledger receipts).

---

## 2. Master Screenshot Catalog

| Screenshot ID | Screen / Page | Feature Demonstrated | Exact UI State | Importance & Technical Significance | Report Section | Slide # | Suggested Caption |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SS-01** | `client/src/pages/Home.jsx` | Dashboard & PWA Experience | Home screen showing hidden/revealed balance pill, quick actions, "New Features" section, and bottom navigation. | Demonstrates core consumer MFS ergonomics, accessibility compliance (tap targets >= 44px), and bilingual branding. | Section 1, 28 | Slide 4 | *FinMate AI consumer dashboard showing live synthetic balance, quick actions, and bilingual navigation.* |
| **SS-02** | `client/src/components/CopilotModal.jsx` | Copilot Launch & Multi-Line Chips | Modal open with greeting, AI deterministic mode badge ("AI: mock mode" or model indicator), and two-line prompt chips. | Proves seamless conversational entry point; shows UX fix displaying example queries across two lines for readability. | Section 5, 29 | Slide 5 | *AI Financial Copilot interface featuring multi-line responsive prompt chips and system status badge.* |
| **SS-03** | `client/src/components/CopilotModal.jsx` | Conversational Balance Query | User inputs *"amar balance koto"* or *"check balance"*; assistant returns formatted BDT balance (`৳25,450.00`). | Shows deterministic regex intent parsing, zero LLM hallucination on financial ledger balance, and poisha-to-BDT conversion. | Section 5, 11 | Slide 5 | *Copilot querying the double-entry ledger directly and returning exact verified user balance.* |
| **SS-04** | `client/src/components/CopilotModal.jsx` | Spending Analysis & Breakdown | User asks *"analyze spending"*; assistant outputs structured breakdown of Send Money, Cash Out, and Bill Pay with totals. | Illustrates automated aggregation of ledger transactions over a 30-day window without sending PII to external APIs. | Section 5, 13 | Slide 5 | *Automated 30-day spending analysis categorizing MFS volume directly from ledger records.* |
| **SS-05** | `client/src/components/CopilotModal.jsx` | Financial Personalization / Habits | User asks *"what are my spending habits"*; Copilot identifies top recipient, regular merchant, and active auto-save rules. | Proves user-scoped financial profiling using deterministic database queries, respecting tenant isolation. | Section 13, 29 | Slide 8 | *Financial memory profile summarizing habitual transaction counterparties and savings behavior.* |
| **SS-06** | `client/src/components/CopilotModal.jsx` | In-Memory RAG Knowledge Retrieval | User asks *"how does guardian mode work?"* or *"send money fee"*; assistant retrieves exact paragraph from `mfs_knowledge.json`. | Demonstrates deterministic TF-IDF cosine similarity search across static policies; zero hallucination on fee tiers. | Section 7, 10 | Slide 10 | *In-memory TF-IDF RAG retrieval returning verified institutional policies and fee structures.* |
| **SS-07** | `client/src/components/CopilotModal.jsx` | Micro-Savings Rule Creation | User asks *"save 5% on every send money"*; Copilot parses intent, creates rule via `savingsRule.service.js`, and confirms. | Validates conversational configuration of autonomous financial automation using integer percentage logic. | Section 12, 29 | Slide 7 | *Conversational activation of automated 5% micro-savings deduction on outbound transfers.* |
| **SS-08** | `client/src/pages/Savings.jsx` | Micro-Savings Management Dashboard | Dedicated savings screen displaying active rules (Round-up, Percentage, Threshold) and accumulated vault balance. | Confirms full UI + Copilot dual parity; users can inspect and manage automation rules from both visual UI and chat. | Section 12, 28 | Slide 7 | *Dedicated Savings screen detailing active rules, accumulated vault totals, and automated triggers.* |
| **SS-09** | `client/src/components/CopilotModal.jsx` | Conversational Action & Pending Card | User types *"send 500 to 01711000002"*; Copilot renders interactive `PendingAction` confirmation card with fee preview. | Core safety architecture: LLM/regex never mutates money directly; requires explicit user visual confirmation. | Section 5, 18 | Slide 9 | *Interactive PendingAction confirmation card generated by Copilot requiring explicit user authorization.* |
| **SS-10** | `client/src/components/CopilotModal.jsx` | AI Financial Guardian Warning Banner | User initiates transfer to unfamiliar recipient late at night; amber/red Guardian risk banner displays score `0.70` + reasons. | Illustrates deterministic multi-signal heuristic risk engine (`guardianRisk.service.js`) warning the user before funds move. | Section 11, 29 | Slide 6 | *AI Guardian risk assessment flagging high-risk transfer with heuristic risk signals and explanation.* |
| **SS-11** | `client/src/components/PinModal.jsx` | PIN Security Step-Up Modal | Modal requesting 4-digit secret PIN with masked keypad input and lockout protection. | Enforces non-negotiable security rule: money mutations require cryptographic bcrypt hash verification on the backend. | Section 18, 19 | Slide 11 | *PIN step-up verification modal protecting pending mutations against unauthorized or automated execution.* |
| **SS-12** | Dual Browser View (Client A & B) | Socket.IO Realtime Transfer Sync | Side-by-side view: Client A confirms ৳500 transfer; Client B's wallet balance and transaction feed immediately update (+৳500). | Proves realtime bi-directional Socket.IO push (`wallet:balance`, `transaction:new`) across authenticated rooms without polling. | Section 20, 29 | Slide 12 | *End-to-end Socket.IO realtime balance update across sender and receiver windows without page reload.* |
| **SS-13** | `client/src/pages/History.jsx` | Double-Entry Audit Trail & Receipts | Transaction history page showing immutable ledger records, transaction IDs, counterparty numbers, and status badges. | Confirms append-only ledger compliance; displays zero balance discrepancy and exact minor-unit poisha precision. | Section 17, 28 | Slide 10 | *Immutable double-entry transaction history with detailed transaction metadata and audit stamps.* |
| **SS-14** | `client/src/pages/Login.jsx` & Header | Secure Session Termination / Logout | User triggers *"logout"* via Copilot or clicks Profile -> Logout; JWT removed from localStorage and user redirected to `/login`. | Demonstrates conversational and manual session invalidation, clearing client memory and socket connections. | Section 18, 28 | Slide 11 | *Session termination flow redirecting user to login screen and severing authenticated socket namespaces.* |

---

## 3. Existing Artifact Image Mapping

The following captured artifacts in the workspace artifact repository (`.gemini/antigravity/brain/88783a6f-be9b-43f1-8e48-efd106de20a3/`) directly correspond to this plan and are verified ready for report embedding:

| Planned ID | Existing Artifact File Name | Verifiable Content / Features |
| :--- | :--- | :--- |
| **SS-02** | `copilot-initial-modal.png` | Copilot modal greeting, multi-line suggestion chips, clean glassmorphic UI. |
| **SS-03** | `copilot-balance-check.png` | Conversational balance query returning verified wallet balance. |
| **SS-04 / SS-05** | `copilot-habits-explanation.png` | Comprehensive spending habits analysis and breakdown by category. |
| **SS-07** | `copilot-micro-savings-setup.png` | Conversational micro-savings rule creation and confirmation. |
| **SS-06** | `copilot-rag-documentation.png` | TF-IDF RAG policy query retrieval explaining Guardian Mode and limits. |
| **SS-09 / SS-10**| `copilot-guardian-confirmation-card.png`| High-risk transfer trigger showing Guardian warning and confirmation button. |
| **SS-12 (Before)**| `realtime-user-b-before.png` | Receiver wallet initial balance state prior to transfer. |
| **SS-12 (After)** | `realtime-user-b-after.png` | Receiver wallet state updating instantly upon transfer settlement. |
| **SS-01** | `new-features-section-en.png` | Dashboard home screen with "New Features" section and quick actions. |

---

## 4. Screenshot Capture Guidelines & Settings

To maintain academic and professional consistency across all figures:
1. **Device Viewport**: Emulate mobile viewport (`390 x 844` px, iPhone 14 / modern Android) to reflect the primary mobile PWA target.
2. **Theme Consistency**: Capture primary flows in Light Mode, with complementary Dark Mode captures for Section 28 (UI Design System).
3. **Data Integrity**: All figures must display synthetic numbers (e.g., `01711000001`, `01711000002`) and simulated poisha currency. No real PII or external branding.
4. **Resolution**: Render at 2x DPI (`dpr=2`) for crisp vector and text reproduction in PDF reports.
