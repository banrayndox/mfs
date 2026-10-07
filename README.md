# 🛡️ UPAY - powered by ai

<div align="center">

### AI-Powered Financial Copilot & Mobile Financial Service Platform

**A smarter MFS experience with AI Copilot, Guardian Mode, Children Accounts, Personalized Savings, Automation, Reminders, and Group Bills.**

![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules-339933?logo=node.js\&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react\&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248?logo=mongodb\&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io\&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF\&logo=vite\&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-10B981?logo=pwa\&logoColor=white)
![Status](https://img.shields.io/badge/Status-Synthetic%20Prototype-orange)

</div>

---

## 📑 Table of Contents

* [Overview](#overview)
* [Problem](#problem)
* [Solution](#solution)
* [Key Features](#key-features)
* [AI Financial Copilot](#ai-financial-copilot)
* [Guardian Mode](#guardian-mode)
* [Children Accounts](#children-accounts)
* [Personalized Savings](#personalized-savings)
* [Smart Reminders & Automation](#smart-reminders--automation)
* [Scheduled & Rule-Based Transactions](#scheduled--rule-based-transactions)
* [Group Bills](#group-bills)
* [Security & Transaction Confirmation](#security--transaction-confirmation)
* [Realtime Experience](#realtime-experience)
* [Architecture](#architecture)
* [AI Architecture](#ai-architecture)
* [RAG Architecture](#rag-architecture)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [Database Architecture](#database-architecture)
* [API Overview](#api-overview)
* [Authentication & Security](#authentication--security)
* [Installation](#installation)
* [Running the Application](#running-the-application)
* [Testing](#testing)
* [Limitations](#limitations)
* [Future Improvements](#future-improvements)
* [Team](#team)

---

## Overview

**UPAY powered by ai** transforms a traditional Mobile Financial Service (MFS) platform into an intelligent financial companion.

Instead of forcing users to navigate through multiple screens for everyday financial tasks, UPAY introduces an **AI Financial Copilot** that allows users to interact with their financial services using natural language.

The platform focuses on five major areas:

* **AI-powered financial assistance**
* **Guardian Mode & Children Accounts**
* **Personalized savings**
* **Financial automation & reminders**
* **Group bill management**

The AI Copilot and the traditional UI use the **same backend service layer**, ensuring that financial operations follow the same validation, authorization, and security rules regardless of how they are initiated.

---

# Problem

### 1. Limited Financial Control for Families

Parents and guardians have limited control over how children use their MFS accounts. A simple account-access model does not provide enough supervision for spending limits, transaction approval, or monitoring.

### 2. Saving Money Requires Discipline

Users often want to save money for specific goals but forget to transfer money regularly. Traditional saving mechanisms also provide limited flexibility for personalized saving habits.

### 3. Repetitive Financial Tasks

Common activities such as sending money, paying bills, setting reminders, and handling recurring expenses require users to repeatedly navigate through different screens.

### 4. Complex MFS Navigation

Users have to manually find separate sections for balance, transactions, bills, savings, account settings, and other services instead of having one unified interface.

### 5. Shared Expenses Are Difficult to Manage

When friends, classmates, or families share an expense, calculating individual shares and tracking who has paid becomes a manual process.

### 6. AI Cannot Be Trusted With Uncontrolled Financial Actions

A generic AI model can misunderstand user intent or generate incorrect values. Financial actions therefore require a secure boundary between natural-language interaction and actual money movement.

---

# Solution

**UPAY powered by ai** addresses these problems by turning the MFS application into an intelligent, personalized, and automation-friendly financial platform.

### 1. AI Financial Copilot

Users can interact with the application using natural language in:

* Bangla
* English
* Colloquial language
* Banglish / transliterated Bangla

The Copilot can understand supported requests such as:

* Checking balance
* Sending money
* Cashing out
* Paying bills
* Mobile recharge
* Managing savings
* Creating reminders
* Scheduling transactions
* Creating automation rules
* Managing account settings

---

### 2. Guardian Mode

**Guardian Mode** provides an additional layer of financial protection for vulnerable users.

A guardian can:

* Create and manage children accounts
* Set daily spending limits
* Monitor transactions
* Receive realtime transaction updates
* Approve or reject sensitive transactions
* Configure different levels of account control

This creates a safer financial environment without completely removing the child's ability to use the account.

---

### 3. Children Accounts

UPAY supports dedicated **Children Accounts** connected to a guardian.

Guardians can choose from multiple control modes:

* `APPROVAL_REQUIRED`
* `LIMITED`
* `UPDATES_ONLY`

This allows guardians to decide how much freedom a child should have while still maintaining visibility and control.

---

### 4. Personalized Savings

Users can create customized saving plans based on their own financial goals.

Supported saving modes include:

* **Percentage Saving**
* **Round-Up Saving**
* **Goal-Based Saving**
* **Threshold-Based Saving**

For example:

> Save 2% every time I spend money.

or:

> I want to save ৳10,000 for a laptop in 3 months.

The system automatically tracks the savings plan and updates the progress.

---

### 5. Smart Reminders & Automation

Users can create reminders for important financial activities.

The platform also supports automated financial actions through:

* One-time schedules
* Recurring schedules
* Conditional rules
* Event-based automation

This reduces the need for users to repeatedly perform the same financial task manually.

---

### 6. Group Bills

UPAY makes shared expenses easier to manage.

Users can:

* Create a group bill
* Add multiple participants
* Split expenses equally
* Create custom individual shares
* Track participant payments
* Monitor settlement progress
* Automatically complete the bill when everyone has paid

This is useful for:

* Friends
* Roommates
* Family expenses
* Group meals
* Trips
* Events

---

### 7. Secure AI Financial Actions

AI does not directly move money.

For sensitive operations, the Copilot first creates a structured action preview.

The user then:

1. Reviews the action
2. Sees the transaction details
3. Reviews any applicable risk warnings
4. Enters the 4-digit PIN
5. The backend validates the action
6. The financial service executes the transaction

This creates a clear security boundary between **AI conversation and actual financial execution**.

---

# Key Features

| Feature                     | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| **AI Financial Copilot**    | Conversational interface for supported MFS operations        |
| **Guardian Mode**           | Guardian-controlled financial supervision                    |
| **Children Accounts**       | Dedicated child accounts with configurable controls          |
| **Spending Limits**         | Daily spending limits for children                           |
| **Transaction Approval**    | Guardian approval for sensitive child transactions           |
| **Personalized Savings**    | Goal-based and customizable saving mechanisms                |
| **Round-Up Savings**        | Automatically save the difference from rounded spending      |
| **Savings Goals**           | Track progress toward financial goals                        |
| **Smart Reminders**         | Reminders for important financial activities                 |
| **Scheduled Transactions**  | One-time and recurring automated actions                     |
| **Rule-Based Automation**   | Trigger financial actions based on conditions                |
| **Group Bills**             | Split and track shared expenses                              |
| **Realtime Updates**        | Live balance, transaction, notification and guardian updates |
| **Financial Memory**        | Persistent savings preferences and financial goals           |
| **RAG Knowledge Base**      | Retrieval of MFS policies, fees and documentation            |
| **Secure PIN Confirmation** | PIN-based authorization for sensitive operations             |
| **Scam Detection**          | Rule-based analysis of suspicious payment messages           |

---

# AI Financial Copilot

The AI Copilot is the primary conversational interface of UPAY.

Users do not need to remember where a particular feature exists in the application.

Instead of navigating through menus, they can simply communicate their intent.

### Example Commands

```text
"আমার ব্যালেন্স কত?"

"Send 500 taka to Rahim."

"আজকে আমি কত টাকা খরচ করেছি?"

"আমার laptop savings কতদূর?"

"Set a reminder for my electricity bill."

"Schedule 1000 taka every month."

"Create a group bill for our dinner."

"Cash out 2000 taka."

"Change my PIN."
```

The Copilot identifies the user's intent and required parameters before interacting with the backend.

### Missing Information

The system does not blindly execute incomplete commands.

For example:

```text
User:
"Send money to Rahim."

Copilot:
"How much would you like to send?"
```

This prevents the system from guessing important financial parameters.

---

# Guardian Mode

Guardian Mode is one of the core innovations of UPAY.

It allows a guardian to supervise another account while still providing controlled financial independence.

### Guardian Capabilities

* Add children
* Configure spending limits
* Change child control modes
* Monitor child transactions
* Receive realtime updates
* Approve pending transactions
* Reject transactions
* Review transaction activity

### Control Modes

#### `APPROVAL_REQUIRED`

Every applicable child transfer requires guardian approval.

```text
Child → Transaction Request
          ↓
     Pending Approval
          ↓
      Guardian
       ↓   ↓
    Approve Reject
```

#### `LIMITED`

Transactions within the configured daily limit can proceed automatically.

Transactions exceeding the limit are blocked.

#### `UPDATES_ONLY`

The child can perform transactions normally, while the guardian receives realtime updates.

---

# Children Accounts

UPAY allows guardians to create dedicated child accounts.

Each child account can have:

* Guardian relationship
* Daily spending limit
* Transaction control mode
* Transaction monitoring
* Approval workflow
* Realtime guardian notifications

This provides a balance between **financial independence and parental supervision**.

---

# Personalized Savings

UPAY allows users to build savings habits automatically.

## Supported Modes

### 1. Percentage

Save a percentage of every eligible transaction.

```text
Spend = ৳300
Saving Rate = 2%

Saved = ৳6
```

### 2. Round-Up

Round the transaction to a configured amount and save the difference.

```text
Spend = ৳87
Round-up = ৳100

Saved = ৳13
```

### 3. Goal-Based

Users can define a financial goal.

```text
Goal = ৳10,000
Duration = 3 months

Target monthly pace ≈ ৳3,333
```

### 4. Threshold

When spending exceeds a configured threshold, the system applies the configured saving rule.

---

# Smart Reminders & Automation

UPAY allows users to create reminders and automate repetitive financial activities.

Examples:

```text
"Remind me to pay electricity bill on the 5th."

"Remind me about my rent every month."

"Schedule my monthly transfer."

"Whenever money comes into my account, save part of it."
```

Automation reduces repetitive manual interaction and helps users build consistent financial habits.

---

# Scheduled & Rule-Based Transactions

UPAY supports both scheduled and conditional financial automation.

### Scheduled Transactions

Users can create:

* One-time transfers
* Recurring transfers
* Scheduled payments

Example:

```text
Send ৳1000 every month on the 5th.
```

### Rule-Based Automation

Users can create financial rules based on events or conditions.

Example:

```text
Whenever money is credited,
automatically save part of it.
```

The scheduler uses persistent jobs and lease locking to prevent duplicate execution.

---

# Group Bills

Group Bills simplify shared expenses.

### Workflow

```text
Create Group Bill
       ↓
Add Participants
       ↓
Choose Equal / Custom Split
       ↓
Participants Pay
       ↓
Realtime Progress Updates
       ↓
All Settled
       ↓
Bill Completed
```

### Supported Splitting

* Equal split
* Custom split
* Individual settlement tracking
* Realtime progress
* Automatic completion

---

# Security & Transaction Confirmation

Financial actions are separated from normal conversational interaction.

### Two-Phase Financial Action

```text
Natural Language Request
          ↓
Intent & Parameter Validation
          ↓
Guardian / Risk Evaluation
          ↓
Pending Action
          ↓
Confirmation Card
          ↓
4-Digit PIN
          ↓
Step-Up Verification
          ↓
Financial Service
          ↓
Transaction Execution
```

The AI cannot bypass the confirmation layer.

Sensitive operations require PIN verification before execution.

---

# Financial Guardian & Risk Analysis

Before an outgoing transaction is confirmed, UPAY evaluates transaction context.

Current risk signals include:

| Signal                 | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| **New Recipient**      | Recipient has not previously been used                  |
| **Unusual Amount**     | Amount is significantly higher than historical spending |
| **Historical Maximum** | Amount exceeds previous transaction records             |
| **Unusual Time**       | Transaction occurs during unusual hours                 |
| **Rapid Transactions** | Multiple transactions happen within a short period      |

If risk signals are detected, the user receives an explainable warning before confirmation.

---

# Realtime Experience

UPAY uses **Socket.IO** to keep important financial information synchronized in realtime.

Realtime updates include:

* Wallet balance
* Incoming transactions
* Transaction history
* Notifications
* Guardian approval requests
* Guardian decisions
* Group bill progress
* Savings progress

### Socket Rooms

Each authenticated user joins a private room:

```text
user:<userId>
```

Group bills use dedicated resource rooms:

```text
group_bill:<requestId>
```

If Socket.IO becomes unavailable, the application continues to work through the REST API.

---

# Architecture

UPAY follows a **Single Service Layer** architecture.

```text
┌───────────────────────────────┐
│        User Interfaces        │
│                               │
│  React PWA    AI Financial    │
│               Copilot         │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        Express REST API       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       Single Service Layer     │
│                               │
│ Transaction Service            │
│ Guardian Service               │
│ Savings Service                │
│ Scheduler Service              │
│ Rule Service                   │
│ Financial Analysis             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│          MongoDB              │
│                               │
│ Wallets • Ledger • Transactions│
│ Guardian • Savings • Rules     │
│ Schedules • Memories           │
└───────────────────────────────┘
```

### Two Doors, One Brain

The traditional UI and AI Copilot call the same backend services.

```text
Manual UI ───────┐
                 ├──► Service Layer ───► Database
AI Copilot ──────┘
```

This prevents financial logic from being duplicated across different interfaces.

---

# AI Architecture

```text
User Command
     │
     ▼
Intent Classification
     │
     ├──► App Control
     │
     ├──► Read Operations
     │
     ├──► Savings
     │
     ├──► Knowledge / RAG
     │
     └──► Financial Mutation
              │
              ▼
       Guardian Evaluation
              │
              ▼
       Pending Action
              │
              ▼
       Confirmation Card
              │
              ▼
           4-Digit PIN
              │
              ▼
       Step-Up Verification
              │
              ▼
       Financial Service
```

The current runtime supports deterministic intent classification and parameter extraction.

Groq integration can be configured for generative AI functionality.

---

# RAG Architecture (Okapi BM25 Retrieval Engine)

UPAY includes a self-contained RAG knowledge pipeline powered by the **Okapi BM25** ranking algorithm (`k1 = 1.5`, `b = 0.75`), replacing simple cosine similarity with document-length normalized probabilistic term weighting.

### Retrieval Performance & Metrics
- **Recall@1**: 100%
- **Recall@3**: 100%
- **Mean Reciprocal Rank (MRR)**: 1.0
- **Throughput**: >33,000 queries/second under concurrency

### Knowledge Sources

The knowledge base covers:

* MFS policies & fee schedules
* Savings guidance & automated micro-savings modes
* Guardian policies & child account supervision
* PIN, biometric & security policies
* Group bill split regulations
* Account tiers & daily limits

### Important Boundary

RAG is used strictly for **knowledge and documentation queries**.

It is not used as the source of truth for:

* Wallet balance
* Transaction history
* Financial calculations
* Money movement

Authoritative financial information comes exclusively from the application's double-entry database and deterministic service layer.

---

# Technology Stack

| Layer                    | Technologies                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| **Frontend**             | React 18, Vite 6, Tailwind CSS, Zustand, React Router              |
| **Backend**              | Node.js, Express, Mongoose                                         |
| **Database**             | MongoDB 7+                                                         |
| **Realtime**             | Socket.IO                                                          |
| **AI**                   | AI Copilot, deterministic intent engine, optional Groq integration |
| **RAG**                  | Node.js TF-IDF cosine similarity                                   |
| **Authentication**       | JWT, HTTP-only cookies, bcrypt                                     |
| **Security**             | Helmet, CORS, rate limiting, PIN step-up                           |
| **Testing**              | Vitest, Supertest, Puppeteer                                       |
| **PWA**                  | Vite PWA                                                           |
| **Internationalization** | i18next, Bangla & English                                          |

---

# Project Structure

```text
mfs/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── agent/
│   │   │   │   └── AgentModal.jsx
│   │   │   ├── auth/
│   │   │   ├── layout/
│   │   │   ├── modals/
│   │   │   └── ui/
│   │   │
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── locales/
│   │   ├── pages/
│   │   ├── services/
│   │   └── stores/
│   │
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── knowledge/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── scripts/
│   └── tests/
│
├── docs/
├── AGENTS.md
└── package.json
```

---

# Database Architecture

UPAY uses MongoDB with dedicated collections for different financial and application entities.

| Collection           | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `users`              | User identity, role, PIN hash and account type |
| `wallets`            | Primary, agent and savings wallet balances     |
| `ledger_entries`     | Double-entry financial records                 |
| `transactions`       | Transaction history and status                 |
| `financial_memories` | Savings preferences and financial goals        |
| `savings_plans`      | Savings targets and progress                   |
| `protected_profiles` | Child account limits and controls              |
| `guardian_links`     | Guardian-child relationships                   |
| `money_requests`     | Payment and group bill requests                |
| `schedules`          | Scheduled transactions                         |
| `rules`              | Conditional automation rules                   |
| `reminders`          | Financial reminders                            |
| `notifications`      | User notifications                             |
| `pending_actions`    | Pending AI financial actions                   |
| `consumed_tokens`    | Anti-replay protection                         |
| `audit_logs`         | Security audit records                         |

---

# Financial Integrity

UPAY uses integer **poisha** rather than floating-point currency calculations.

```text
৳1.00 = 100 poisha
```

Financial mutations use paired ledger entries.

```text
Sender Wallet
     │
     ├── Debit
     │
     ▼
Receiver Wallet
     │
     └── Credit
```

This provides deterministic financial calculations and prevents floating-point currency errors.

---

# API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/step-up
GET  /api/auth/me
POST /api/auth/change-pin
```

### Wallet & Transactions

```text
GET  /api/wallet/balance
GET  /api/wallet/history
POST /api/wallet/send
POST /api/wallet/cashout
POST /api/wallet/bill
POST /api/wallet/recharge
POST /api/wallet/addmoney
```

### AI Copilot

```text
POST /api/copilot/message
POST /api/copilot/confirm
GET  /api/copilot/insights
GET  /api/copilot/memory
POST /api/copilot/savings/configure
```

### Guardian Mode

```text
GET  /api/guardians/status
GET  /api/guardians/pending-approvals
POST /api/guardians/approvals/:txnId/decide
POST /api/guardians/children/:childId/mode
```

### Group Bills

```text
GET  /api/requests
POST /api/requests
POST /api/requests/:id/pay
```

### Schedules & Rules

```text
GET  /api/schedules
POST /api/schedules/prepare
POST /api/schedules/confirm

GET  /api/schedules/rules
POST /api/schedules/rules/prepare
POST /api/schedules/rules/confirm
```

### Safety

```text
POST /api/safety/check-message
GET  /api/safety/notifications
POST /api/safety/notifications/:id/read
```

---

# Authentication & Security

### JWT Authentication

Authenticated sessions use JWT access tokens with refresh-token support.

### PIN Step-Up

Financial mutations require an additional PIN verification step.

```text
Tier 1
  ↓
Read-only operations

Tier 2
  ↓
Financial mutations
  ↓
4-digit PIN
  ↓
Step-up token
```

### Anti-Replay Protection

Step-up tokens are consumed after execution to prevent reuse.

### Brute Force Protection

Repeated incorrect PIN attempts trigger account lockout protection.

### AI Safety Boundary

The AI layer cannot directly bypass the financial service layer or execute a money-moving operation without the required authorization.

---

# Installation

```bash
git clone https://github.com/your-username/guardian-mfs.git

cd guardian-mfs

npm install

cp .env.example .env
```

Configure the required environment variables in `.env`.

---

# Environment Variables

```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

MONGODB_URI=

JWT_ACCESS_SECRET=dev-access-secret-32-characters-minimum
JWT_REFRESH_SECRET=dev-refresh-secret-32-characters-minimum

GROQ_API_KEY=
GROQ_MODEL_TEXT=openai/gpt-oss-120b
```

> Use strong and unique JWT secrets for production deployments.

---

# Running the Application

### Development Mode

Run frontend and backend together:

```bash
npm run dev
```

### Backend

```bash
npm run dev:server
```

Backend:

```text
http://localhost:5000
```

### Frontend

```bash
npm run dev:client
```

Frontend:

```text
http://localhost:5173
```

---

# Testing & Benchmarks

The project includes an extensive automated testing and benchmark suite covering financial transactions, security boundaries, guardian workflows, payment providers, and quantitative AI evaluation.

### Run Full Test Suite (22 suites / 201 tests)

```bash
npm run test
```

### Run Quantitative AI/ML Evaluation Suite (48 test utterances & 24 RAG queries)

```bash
npm run eval:agent
```

### Run High-Concurrency Load Benchmark

```bash
npm run test:load
```

### Security & Hardening Tests

```bash
npx vitest run server/tests/security_hardening_and_idor.test.js
```

### Payment Provider & Webhook Tests

```bash
npx vitest run server/tests/payment_provider_and_webhooks.test.js
```

### Linting & Build Verification

```bash
npm run lint
npm run build
```

---

# Limitations

1. **Synthetic Payment Rails**
   All transactions are simulated. The application does not connect to real Bangladesh Bank payment infrastructure. Abstracted payment providers (`MockPaymentProvider` and `SandboxPaymentProvider`) simulate provider lifecycle state machines with HMAC-SHA256 signed webhooks.

2. **AI Model Dependency & Offline Mode**
   Generative AI functionality optionally connects to Groq Cloud LLM. When an API key is omitted, the application operates in 100% deterministic local mode with zero cloud dependencies and a visible "AI: mock mode" badge.

3. **In-Memory Okapi BM25 RAG**
   Knowledge retrieval uses an industry-standard Okapi BM25 ranking algorithm (k1=1.5, b=0.75) operating over structured institutional documentation, achieving 100% Recall@1, Recall@3, and MRR 1.0 without external vector DB overhead.

4. **Prototype Environment**
   The platform is designed as an AI Hackathon prototype; all money is simulated in integer poisha with MongoDB double-entry ACID transactions.

---

# Future Improvements

Potential future improvements include:

* Real MFS/banking API integration
* Advanced Bangla voice interaction
* Stronger multilingual intent understanding
* External embedding-based RAG
* Hybrid BM25 + vector search
* More advanced financial insights
* Expanded guardian controls
* QR-based merchant payments
* Automated investment and savings products
* Biometric authentication
* More advanced AI financial planning

---

# Why UPAY?

UPAY is not just another MFS interface.

It combines:

```text
                 ┌─────────────────────┐
                 │   AI Financial       │
                 │      Copilot        │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    Guardian Mode      Smart Savings      Automation
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   UPAY MFS    │
                    │   Platform    │
                    └───────┬───────┘
                            │
                    ┌───────┴────────┐
                    │                │
               Group Bills      Secure Actions
```

The goal is to make financial services:

* **More conversational**
* **More personalized**
* **More automated**
* **More family-friendly**
* **More secure**
* **Easier to use**

---

# Team

Developed for the **MFS Hackathon / Competition** by:

## NOT HUMAN

> **UPAY powered by ai — Making financial services smarter, safer, and simpler.**

---

> **All rights reserved. Synthetic prototype. No real funds are processed.**
