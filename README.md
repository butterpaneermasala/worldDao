# 🌍 worldDao: A Decentralized Governance and Treasury Platform

Welcome to the official repository for **worldDao**, a comprehensive platform for decentralized governance, proposal management, NFT auctions, and treasury control.

---

## 📖 Overview

**worldDao** is a full-stack decentralized application (dApp) that empowers communities to govern themselves effectively on the blockchain.
It combines a user-friendly frontend with a robust set of smart contracts to provide a complete DAO experience.

This monorepo includes:

* 🖥️ A user-facing web application for interacting with the DAO
* 📜 Smart contracts for governance (proposals & voting)
* 🎝 Smart contracts for NFT auctions and voting
* 💰 Smart contracts for DAO treasury management

---

## 🌐 Deployment & Vision

* Deployed as a **Mini App** on the **World Chain Sepolia testnet**.
* **Human Network Integration**: Designed to leverage a **global human network** via **World ID**, ensuring each participant is a unique verified human.
* Goal: Build a **digitally-native cooperative** where every verified human has a voice, enabling **collective intelligence** to guide the organization.

---

## ✨ Core Features

* 🗳 **On-Chain Governance** – Create, view, and vote on proposals
* 👥 **Candidate System** – Nominate and manage candidates for governance roles
* 🌈 **NFT Auction House** – Mint and auction NFTs for fundraising or distribution
* 🔗 **Integrated Voting** – NFT-based weighted voting or other criteria
* 💰 **Treasury Management** – Secure DAO fund management via proposals
* 🔌 **Web3 Integration** – Wallet connections using **Web3Modal**
* 🧹 **Modular Architecture** – Separation between frontend & contracts

---

## 🛠 Tech Stack

### Frontend

* Next.js
* React
* Tailwind CSS
* Ethers.js
* Web3Modal

### Smart Contracts

* Solidity

### Development Environments

* Hardhat (Governor, Treasury)
* Foundry (Auction, Voting)

### Blockchain

* 🌐 EVM-compatible chains (Deployed on **Worldchain Sepolia**)

---

## 🗂 Architecture & File Breakdown

```
worldDao/
│
├── frontend/              # Next.js frontend
│
├── contracts/
│   ├── world-governor/    # Hardhat - Governance
│   │   ├── WorldChainGovernor.sol
│   │   └── CandidateContract.sol
│   │
│   ├── Auction/           # Foundry - NFT Auctions
│   │   ├── NFTMinter.sol
│   │   ├── NFTAuction.sol
│   │   └── Voting.sol
│   │
│   └── world-treasure/    # Hardhat - Treasury
│       └── Treasury.sol
```

---

## 🚀 Getting Started

### ✅ Prerequisites

* Node.js (v18+)
* Git
* Foundry

### 🔧 Installation & Setup

**Clone Repository**

```bash
git clone --recurse-submodules https://github.com/butterpaneermasala/worldDao.git
cd worldDao
```

**Setup Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open 👉 [http://localhost:3000](http://localhost:3000)

**Setup Contracts**

* Hardhat (Governor & Treasury)

```bash
cd contracts/world-governor
npm install
# Repeat for contracts/world-treasure
```

* Foundry (Auction)

```bash
cd contracts/Auction
forge install
```

---

## 🧪 Running Tests

**Frontend**

```bash
cd frontend
npm run test
```

**Hardhat Contracts**

```bash
cd contracts/world-governor
npx hardhat test
```

**Foundry Contracts**

```bash
cd contracts/Auction
forge test
```

---

## 🤝 Contributing

We welcome contributions!

1. Fork the project
2. Create a feature branch

   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit changes

   ```bash
   git commit -m "Add some AmazingFeature"
   ```
4. Push branch

   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](./LICENSE) for details.
