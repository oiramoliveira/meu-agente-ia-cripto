# Agent That Pays For Itself With x402

An AI agent that runs **100% locally** on a weak PC, thinks with `phi3:mini`, and **pays by itself** for data using the **x402 protocol** on **Base Sepolia testnet**.

No MetaMask popup. No manual click. No hosted demo that can die. This repo runs **both sides**:

- `server.js` = the seller that charges 0.01 USDC
- `index.js` = the buyer agent that pays 0.01 USDC

**Proven result:** Buyer wallet went from **40 USDC -> 39.99 USDC** after 1 payment. Terminal shows `Status: 200`.

---

## Table of Contents

1. What This Project Does
2. How It Works
3. How To Run From Zero
4. What Each File Does
5. How To Verify Payment
6. Troubleshooting
7. Security

---

## 1. What This Project Does

Imagine a robot that needs data and has its own wallet.

Normally, when you want data from an API, you put a credit card. An AI agent can't do that. The **x402 protocol** solves this: the API answers with `402 Payment Required` + a price, and the agent pays with USDC on Base and retries. The server checks the payment on-chain and gives the data.

This project shows that in the smallest possible way:

- The agent asks a local LLM (`phi3:mini`) a question.
- The agent tries to get data from an API that costs 0.01 USDC.
- The API says: Pay 0.01 USDC first.
- The agent signs a payment with its own private key and sends it.
- A public facilitator verifies the payment on Base Sepolia.
- The API returns the data with `200 OK`.

All of this happens in ~10 seconds, on a PC with **Intel i5-4210U, 8GB RAM, Windows 10**, with no GPU.

---
## 2. How It Works — Detailed Explanation

### 2.1 The 5 Pieces

| Piece | What It Is | What It Does Here |
| :--- | :--- | :--- |
| **Ollama + phi3:mini** | A small LLM that runs on your CPU | The brain. Generates a sentence about why agents should pay for data. |
| **viem** | Library to talk to blockchains in JavaScript | Turns a private key into a wallet that can sign payments. |
| **x402-fetch (v1)** | A fetch wrapper that knows how to pay | When server says 402, it creates a payment, signs it, and retries. |
| **x402-express (v1)** | Express middleware that charges for routes | When someone calls /protected without payment, returns 402 + price. When paid, lets them in. |
| **Facilitator** | Free public server: https://x402.org/facilitator | Checks if payment is valid on Base Sepolia. Seller trusts facilitator, not buyer. |

> **Important:** Buyer uses `x402-fetch` v1 and seller uses `x402-express` v1. They must be same major version. If you mix v1 with `@x402/express` v2, you get `Cannot read properties of undefined (reading 'map')`.

### 2.2 The Full Flow, Step By Step

```text
Agent starts
↓
Agent connects wallet from PRIVATE_KEY in .env
Wallet: 0x29F0... (Buyer, has 40 USDC + 0.02 ETH)
↓
Agent asks Ollama (localhost:11434):
POST /api/generate { model: "phi3:mini", prompt: "Why should AI agents pay for data?" }
↓
Ollama answers:
"Agentes de IA devem pagar por dados para garantir a privacidade..."
↓
Agent tries to get data WITHOUT paying:
GET http://localhost:3000/protected
↓
Seller (server.js) sees no payment → returns:
HTTP 402 Payment Required
Header: PAYMENT-REQUIRED: { price: "$0.01", network: "base-sepolia", payTo: "0xA91c..." }
↓
x402-fetch sees the 402, builds a payment:
Amount: 0.01 USDC = 10000 atomic units (USDC has 6 decimals)
From: 0x29F0... (Buyer)
To: 0xA91c... (Seller)
Network: Base Sepolia (Chain ID 84532)
Signs with Buyer's private key using viem
↓
x402-fetch sends payment to Facilitator:
POST https://x402.org/facilitator/verify + /settle
Facilitator checks on Base Sepolia that signature is valid and buyer has funds.
↓
Agent retries original request, now WITH payment proof in header:
GET http://localhost:3000/protected + Header: X-PAYMENT: <signed proof>
↓
Seller asks Facilitator: "Is this proof valid?"
Facilitator: "Yes, settled on-chain."
↓
Seller returns:
HTTP 200 OK
Body: {"mensagem":"Parabens! Voce pagou 0.01 USDC...", "dado":"..."}
↓
Buyer wallet loses 0.01 USDC (40 → 39.99). Seller wallet gains 0.01 USDC.
```

### 2.3 Why Use Base Sepolia And Testnet USDC?

- **Base Sepolia** is the test network of Base. ETH and USDC there are fake, from faucets, worth $0. You can test without risking real money.
- **USDC testnet** has same contract logic as real USDC, but token address on Base Sepolia is `0x036CbD53842c5426634e79217e7c4B9eF09F1312`.
- To go to mainnet, change 2 lines: `baseSepolia` → `base`, and `https://sepolia.base.org` → `https://mainnet.base.org`, and use real USDC. The x402 code stays the same.

### 2.4 Why Run The Seller Locally?

Public x402 demos (like `x402-demo.vercel.app` or `ai-work-market.vercel.app`) die all the time because owner deletes Vercel deployment. You get `404 DEPLOYMENT_NOT_FOUND` and think your code is broken, but it's the demo that died.

Running `server.js` locally means:
- It never dies.
- You control price, seller address, and data.
- You can show full loop `402 → Pay → 200` without depending on anyone else.

---
## 3. How To Run — From Zero, Step By Step

Follow in order. Don't skip. Each step depends on previous one.

### Step 0 — What You Need

- Windows, Mac or Linux
- Node.js 20+ (tested on Node v24.21.0)
- Internet for faucets and facilitator
- ~30 minutes first time, ~2 minutes after that

### Step 1 — Install Node.js

1. Go to https://nodejs.org, download LTS, install with default options.
2. Open terminal and check:

```bash
node --version
npm --version
```

### Step 2 — Install Ollama + phi3:mini

1. Go to https://ollama.com, download, install.
2. In terminal, run:

```bash
ollama run phi3:mini
```

3. Wait for download (~2.2GB). When you see `>>> Send a message`, Ollama is ready. It serves on `http://localhost:11434`.
4. To test: type `Hello` and press Enter. Press `Ctrl + C` to exit chat, but leave Ollama running, or run `ollama serve` in another terminal.

### Step 3 — Create The Project Folder

```bash
# On Windows
cd C:\
mkdir meu-agente-ia-cripto
cd meu-agente-ia-cripto
```

### Step 4 — Install Dependencies

```bash
npm init -y
npm install dotenv viem x402-fetch
npm install express x402-express
```

- `dotenv` = reads `.env` file
- `viem` = wallet + signing
- `x402-fetch` = buyer that pays (v1)
- `express` = web server
- `x402-express` = seller that charges (v1)

You will see many yellow `npm warn deprecated` lines. Ignore them. At end you should see `added ~584 packages`.

### Step 5 — Create A Test Wallet And Fund It

You need 2 wallets for a clean demo:
- **Buyer:** Will pay. Needs ~0.02 ETH for gas + ~5 USDC to spend.
- **Seller:** Will receive. Needs 0 ETH, just an address.

#### 5.1 Generate a new private key with code

```bash
node -e "const {generatePrivateKey, privateKeyToAccount} = require('viem/accounts'); const k = generatePrivateKey(); console.log('CHAVE:', k); console.log('ENDERECO:', privateKeyToAccount(k).address)"
```

You will get:
```text
CHAVE: 0x + 64 hex chars (66 total) — KEEP SECRET, never share
ENDERECO: 0x + 40 hex chars (42 total) — PUBLIC, you can share
```

#### 5.2 Get test ETH on Base Sepolia

1. Go to https://sepolia-faucet.pk910.de/, paste Buyer address, click Start Mining, wait ~10 min until reward > 0.05, click Stop & Claim. You get Sepolia ETH.
2. Go to https://testnets.superbridge.app/base-sepolia, connect MetaMask, bridge 0.05 ETH from Sepolia → Base Sepolia. Wait ~1 min.

#### 5.3 Get test USDC on Base Sepolia

1. Go to https://faucet.circle.com/
2. Select Asset: `USDC`, Network: `Base Sepolia`
3. Paste Buyer address, click `Send 20 USDC`, solve captcha.
4. Wait 1-2 min. Check on https://sepolia.basescan.org by searching Buyer address → Token Holdings → USDC should be 20.

#### 5.4 Get a Seller address

Use any second address you own. You only need its address, not its private key. Example: `0xA91cba0eB1750e4dec6C86c9dE977D522d267B56`.

### Step 6 — Create The Files

**File 1: `.env`** — secrets, never commit.

```env
PRIVATE_KEY=0x_your_66_char_buyer_private_key_here
RPC_URL=https://sepolia.base.org
OLLAMA_URL=http://localhost:11434
```

- `PRIVATE_KEY` must be 66 chars (`0x` + 64). If 42 chars, you pasted address, not key. Check with: `node -e "require('dotenv').config(); console.log(process.env.PRIVATE_KEY?.length)"` → must be 66.
- No spaces, no quotes, no `...` in key.

**File 2: `.gitignore`**
```text
node_modules
.env
```

**File 3: `server.js`** — see Section 4.
**File 4: `index.js`** — see Section 4.

### Step 7 — Run The Seller

Open Terminal 1:
```bash
node server.js
```
Expected:
```text
Lojinha x402 v1 rodando em http://localhost:3000/protected
```
Leave this terminal open.

### Step 8 — Run The Buyer Agent

Open Terminal 2 (in VSCode: `Ctrl + Shift + `` `):
```bash
node index.js
```
Expected:
```text
1. Ligando carteira de teste...
Carteira: 0x29F0...
2. Perguntando pro phi3:mini...
phi3 disse: "Agentes de IA devem pagar por dados para garantir a privacidade e segurança dos usuários."
3. Tentando recurso pago com x402...
Status: 200
Resposta: {"mensagem":"Parabens! Voce pagou 0.01 USDC e ganhou esse dado!","dado":"O preco do Bitcoin hoje e 100000 (dado de teste)"}
FIM!
```
If you see `Status: 200`, it worked. Your agent paid by itself.

### Step 9 — Run Again To Pay Again

Every time you run `node index.js`, it pays another 0.01 USDC. Run 3 times: 40 → 39.99 → 39.98 → 39.97.

---
## 4. What Each File Does

### `index.js` — The Buyer Agent

```js
require('dotenv').config();
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const { wrapFetchWithPayment } = require('x402-fetch');

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const client = createWalletClient({ account, chain: baseSepolia, transport: http(process.env.RPC_URL) });
  const fetchQuePaga = wrapFetchWithPayment(fetch, client);
  const respostaOllama = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: 'phi3:mini', prompt: 'Why should AI agents pay for data?', stream: false })
  });
  const dadosOllama = await respostaOllama.json();
  console.log('phi3 disse:', dadosOllama.response);
  const urlPaga = 'http://localhost:3000/protected';
  const respostaPaga = await fetchQuePaga(urlPaga);
  console.log('Status:', respostaPaga.status);
  const texto = await respostaPaga.text();
  console.log('Resposta:', texto.slice(0, 500));
}
main();
```

### `server.js` — The Seller API

```js
const express = require('express');
const { paymentMiddleware } = require('x402-express');
const app = express();
const SELLER_ADDRESS = '0xA91cba0eB1750e4dec6C86c9dE977D522d267B56';
app.use(paymentMiddleware(
  SELLER_ADDRESS,
  { "GET /protected": { price: "$0.01", network: "base-sepolia" } },
  { url: "https://x402.org/facilitator" }
));
app.get('/protected', (req, res) => {
  res.json({ mensagem: "Parabens! Voce pagou 0.01 USDC...", dado: "O preco do Bitcoin hoje e 100000 (dado de teste)" });
});
app.listen(3000, () => console.log('Lojinha x402 v1 rodando em http://localhost:3000/protected'));
```

---
## 5. How To Verify The Payment Really Happened

1. Go to https://sepolia.basescan.org
2. Paste Buyer address (e.g. `0x29F0...`) in search.
3. Click `Token Transfers` or `ERC-20 Token Txns`.
4. You will see: `From: 0x29F0... To: 0xA91c... Amount: 0.01 USDC`.
5. In MetaMask, import Buyer account to see balance: `40 USDC → 39.99 USDC` after 1 payment.

If transfer is on Basescan, payment is real and settled on Base Sepolia.

---
## 6. Troubleshooting

| Error / Symptom | What It Means | How To Fix |
| :--- | :--- | :--- |
| `invalid private key, expected hex or 32 bytes` | `.env` has address (42 chars) or placeholder, not key (66 chars) | Check length must be 66. No spaces, no quotes. Generate new key with command in Step 5.1. |
| `Cannot read properties of undefined (reading 'map')` | Buyer v1 + Seller v2 mismatch | Use `x402-fetch` + `x402-express` both v1. Do NOT use `@x402/express` v2 with `x402-fetch` v1. |
| `Status: 404 - DEPLOYMENT_NOT_FOUND` | Public demo URL was deleted | Don't use external demos. Use local `server.js`. |
| `Status: 404 - The page could not be found` | Same, Vercel deployment deleted | Same fix: use local server. |
| `Cannot find module '@x402/evm/exact/server'` | Missing dependency for `@x402/express` v2 | If you stay on v1, you don't need it. If you use v2, run `npm install @x402/evm @x402/core`. |
| Agent stuck on `Perguntando pro phi3...` | Ollama not running | In another terminal: `ollama run phi3:mini` or `ollama serve`. phi3 on i5 takes ~10-20s, wait. |
| `Tokens sent` but MetaMask shows 0 USDC | USDC is on Sepolia, not Base Sepolia, or MetaMask showing wrong account | Check on Basescan. Make sure faucet was set to `Base Sepolia`, not `Sepolia`. Import correct account in MetaMask. |
| `tamanho: 42` when checking key length | You pasted address, not private key | Address is 42 chars (public). Private key is 66 chars (secret). |
| `npm warn deprecated` / `29 vulnerabilities` | Normal warnings for test project | Ignore. They don't block code. |

---
## 7. Security

- This is **testnet only**. `.env` is in `.gitignore` and must never be committed.
- Never paste a private key in chat, screenshot, GitHub, or video. In demos, show only address (`0x29F0...`) and balance, never key.
- For mainnet, use fresh wallet with only amount needed for payments. Never reuse wallet that holds savings.
- To go to mainnet, change in `index.js` and `server.js`: `baseSepolia` → `base`, `https://sepolia.base.org` → `https://mainnet.base.org`, and use real USDC.

---
## License

MIT — free for learning and testing.
