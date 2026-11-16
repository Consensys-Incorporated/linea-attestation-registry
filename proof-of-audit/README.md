# Proof of Audit

> Issue on-chain attestations for smart contract audits using the [Verax Attestation Registry](https://www.ver.ax/).

**🔗 Live Demo:** [audit.examples.ver.ax](https://audit.examples.ver.ax/)

---

## 🎯 Overview

### What is this?

**Proof of Audit** is a reference implementation demonstrating how to issue attestations on the Verax Attestation
Registry. It allows auditors to create on-chain proofs linking:

- A **GitHub repository** (source code)
- A specific **commit hash** (audited version)
- A **smart contract address** (deployed contract)

### What is Verax?

[Verax](https://www.ver.ax/) is an open, public, and shared attestation registry deployed on multiple EVM chains.
Attestations are on-chain statements made by an issuer about a subject, following a predefined schema.

### Use Case

An auditor reviews a smart contract's source code at a specific commit. Once satisfied, they issue an attestation
on-chain, creating a verifiable proof that:

1. The auditor (wallet address) vouches for the code
2. The audit covers a specific commit hash
3. The attestation links to the deployed contract address

Anyone can then verify on the Verax Explorer that a contract has been audited.

---

## 🛠 Tech Stack

| Technology                                                                          | Version | Purpose                     |
| ----------------------------------------------------------------------------------- | ------- | --------------------------- |
| [React](https://react.dev/)                                                         | 19.x    | UI framework                |
| [Vite](https://vitejs.dev/)                                                         | 8.x     | Build tool                  |
| [wagmi](https://wagmi.sh/)                                                          | 3.x     | React hooks for Ethereum    |
| [viem](https://viem.sh/)                                                            | 2.x     | TypeScript Ethereum library |
| [Verax SDK](https://docs.ver.ax/verax-documentation/developer-guides/using-the-sdk) | 5.x     | Attestation registry SDK    |
| [Reown AppKit](https://reown.com/)                                                  | 1.x     | WalletConnect integration   |
| TypeScript                                                                          | 5.x     | Type safety                 |

---

## 📁 Project Structure

```
src/
├── App.tsx                    # Main form and attestation logic
├── App.css                    # Application styles
├── main.tsx                   # React entry point
├── components/
│   ├── ConnectButton.tsx      # Wallet connection button
│   ├── Header.tsx             # App header with logo
│   └── Footer.tsx             # App footer
├── hooks/
│   └── useVeraxSdk.ts         # Verax SDK initialization hook
├── utils/
│   └── constants.ts           # Portal ID, Schema ID, chain config
├── wagmiConfig.ts             # wagmi + WalletConnect configuration
└── Web3ModalProvider.tsx      # Web3 context provider
```

---

## ⚙️ How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User fills    │────▶│  Connect wallet  │────▶│  Sign & submit  │
│   audit form    │     │  (WalletConnect) │     │  transaction    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Attestation   │◀────│  Verax Registry  │◀────│  Portal.attest  │
│   on Explorer   │     │  stores on-chain │     │  SDK call       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **User fills the form** with repo URL, commit hash, and contract address
2. **Connects wallet** via WalletConnect (MetaMask, Rainbow, etc.)
3. **Signs the transaction** to create the attestation
4. **Verax SDK** calls the Portal contract with the attestation data
5. **Attestation is stored** on-chain in the Verax Registry
6. **Viewable on Verax Explorer** with a unique attestation ID

---

## 🚀 Getting Started

### Prerequisites

- The monorepo toolchain (Node.js and pnpm versions from the root `package.json`)
- A WalletConnect Project ID

### Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable                        | Required | Description                                                      |
| ------------------------------- | -------- | ---------------------------------------------------------------- |
| `VITE_WALLETCONNECT_PROJECT_ID` | ✅ Yes   | From [cloud.walletconnect.com](https://cloud.walletconnect.com/) |
| `VITE_GA_ID`                    | ❌ No    | Google Analytics Measurement ID                                  |

### Installation & Development

From the monorepo root:

```bash
pnpm install
pnpm --filter @verax-attestation-registry/proof-of-audit dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

Run these commands from `proof-of-audit/`.

| Script                     | Description                                 |
| -------------------------- | ------------------------------------------- |
| `pnpm run dev`             | Start development server                    |
| `pnpm run build`           | Type-check and build for production         |
| `pnpm run preview`         | Preview production build                    |
| `pnpm run lint`            | Run ESLint                                  |
| `pnpm run typecheck`       | Run TypeScript type checking                |
| `pnpm test`                | Run the unit and integration tests          |
| `pnpm run security:verify` | Check the security regressions on the build |

Prettier runs from the monorepo root (`pnpm run prettier:check`).

---

## 🚢 CI and Deployment

`proof-of-audit.yml` type-checks, tests, and builds the app on each pull request.

The app is deployed by the Vercel Git integration:

- each pull request that touches `proof-of-audit/` gets a preview deployment;
- each merge to `dev` deploys production.

The `VITE_*` variables are set in the Vercel project. `vercel.json` sets the security and cache headers.

---

## 🌐 Supported Networks

| Network       | Type       | Chain ID |
| ------------- | ---------- | -------- |
| Linea Sepolia | Testnet    | 59141    |
| Linea Mainnet | Production | 59144    |

The app defaults to **Linea Sepolia** for safe testing.

---

## 📋 Portal & Schema

### What are Portal and Schema?

- **Schema**: Defines the structure of attestation data (like a database table schema)
- **Portal**: A smart contract that validates and issues attestations following a schema

### Linea Sepolia (Testnet)

| Component  | Address / ID                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Portal** | [`0xbb92965c718852a8dc1b6e930239de4e08d93e60`](https://explorer.ver.ax/linea-sepolia/portals/0xbb92965c718852a8dc1b6e930239de4e08d93e60)                                                 |
| **Schema** | [`0x59ffe1d5bdbd99d418fc1dba03b136176ca52da322cab38fed6f29c2ca29bd71`](https://explorer.ver.ax/linea-sepolia/schemas/0x59ffe1d5bdbd99d418fc1dba03b136176ca52da322cab38fed6f29c2ca29bd71) |

### Schema Structure

```solidity
(string commitHash, string repoUrl)
```

| Field        | Type     | Description                        |
| ------------ | -------- | ---------------------------------- |
| `commitHash` | `string` | Git commit SHA (40 hex characters) |
| `repoUrl`    | `string` | GitHub repository URL              |

The **subject** of the attestation is the smart contract address being audited.

### Attestation Validity

Attestations expire after **30 days**. This is configurable in [`src/utils/constants.ts`](src/utils/constants.ts).

---

## 🧪 Example Input

For testing on Linea Sepolia:

| Field      | Example Value                                               |
| ---------- | ----------------------------------------------------------- |
| Repository | `https://github.com/alainncls/strava-segments-to-nfts-dapp` |
| Commit     | `37f8ecd53a64ba2395b7de0a8d7ecb0dbfdced64`                  |
| Contract   | `0x2fafe2c217be096e09b64c49825fe46b7c3e33b2`                |

---

## 🔐 Security Considerations

- **Client-side validation only**: This app validates inputs on the frontend. The Portal contract should also validate
  data if security is critical.
- **No access control**: The default Portal allows anyone to issue attestations. For production, consider a Portal with
  access control.
- **Attestation ≠ Truth**: An attestation is a statement by an issuer. Verax does not verify the truth of
  attestations—that's the issuer's reputation at stake.

---

## 📚 Resources

| Resource            | Link                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| Verax Documentation | [docs.ver.ax](https://docs.ver.ax/)                                                |
| Verax Explorer      | [explorer.ver.ax](https://explorer.ver.ax/)                                        |
| Verax SDK           | [npm package](https://www.npmjs.com/package/@verax-attestation-registry/verax-sdk) |
| wagmi Documentation | [wagmi.sh](https://wagmi.sh/)                                                      |
| viem Documentation  | [viem.sh](https://viem.sh/)                                                        |

---

## 🤝 Contributing

See the monorepo [contribution guide](../CONTRIBUTING.md).

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.
