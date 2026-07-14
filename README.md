# Clima Backend Blockchain

Backend API + smart contract deployment for a Hyperledger Besu IBFT network using Hardhat.

## Quick architecture

- Local blockchain network with 3 Besu validator nodes via Docker Compose.
- Node.js/Express API in `project/`.
- Solidity contracts deployed with Hardhat Ignition (chainId `1714`).

## Requirements

- Docker and Docker Compose (`docker compose`)
- Node.js 18+ and npm

Check versions:

```bash
docker --version
docker compose version
node -v
npm -v
```

## 1) Start the local blockchain network

From the repository root:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Check running nodes:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected primary local RPC endpoint: `http://localhost:8545`

The following nodes should be running locally:

- `besu-validator1` (RPC: 8545, WS: 8546, P2P: 30303)
- `besu-validator2` (P2P: 30304)
- `besu-validator3` (P2P: 30305)

Recommended checks:

```bash
docker compose -f docker-compose.dev.yml ps
docker logs besu-validator1 --tail 50
docker logs besu-validator2 --tail 50
docker logs besu-validator3 --tail 50
```

## 2) Configure backend and Hardhat

Go into the Node project:

```bash
cd project
npm install
```

Create the environment file `project/.env`:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
JSON_RPC_URL=http://localhost:8545
# Optional: multiple RPC nodes separated by commas
# JSON_RPC_URLS=http://localhost:8545,http://localhost:8546
PORT=3000
```

## 3) Compile and deploy contracts locally

```bash
npm run compile
npm run deploy:local
```

After deployment, the addresses file is generated at:

- `project/ignition/deployments/chain-1714/deployed_addresses.json`

If this file does not exist, the backend cannot initialize contracts.

## 4) Start the API server

```bash
npm run start
```

Development mode:

```bash
npm run dev
```

If everything is set up correctly, the API will be available at `http://localhost:3000`.

## Useful endpoints

Note: some endpoint paths are intentionally kept in Spanish for backward compatibility.

- Network status (view): `GET /node/estado-red`
- Network status (JSON): `GET /node/api/estado-red`

Example:

```bash
curl http://localhost:3000/node/api/estado-red
```

## Authentication for protected endpoints

Some routes use `Authorization: Basic ...` with this format:

`address/timestamp/message:signature`

Steps:

1. Request the hash from the backend:

```bash
curl "http://localhost:3000/login?address=0xYOUR_ADDRESS&message=MY_MESSAGE"
```

Expected response: `timestamp`, `encodedMessage`, and `hash`.

2. Sign the `hash` with the user's private key (Node example):

```bash
export USER_PK=0xYOUR_PRIVATE_KEY
export HASH=paste_hash_here
node -e "const {Wallet}=require('ethers'); const w=new Wallet(process.env.USER_PK); w.signMessage(process.env.HASH).then(console.log)"
```

3. Build the Basic header:

```bash
export ADDRESS=0xYOUR_ADDRESS
export TIMESTAMP=paste_timestamp_here
export MESSAGE=MY_MESSAGE
export SIGNED=0xGENERATED_SIGNATURE
export AUTH=$(printf "%s" "$ADDRESS/$TIMESTAMP/$MESSAGE:$SIGNED" | base64)
```

4. Use `Authorization: Basic $AUTH` in protected requests.

## Register a new user in the community

Endpoint:

- `POST /userVerified/add-user`

Example:

```bash
curl -X POST "http://localhost:3000/userVerified/add-user" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "userAddress": "0xUSER_ADDRESS_TO_REGISTER"
  }'
```

## Register a new measurement

Endpoint:

- `POST /certificationVerified/certify`

Important: `certifiedString` must match the `message` used in authentication.

Example:

```bash
curl -X POST "http://localhost:3000/certificationVerified/certify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "certifiedString": "MY_MESSAGE",
    "description": "New temperature measurement 26.4C in Girona"
  }'
```

## Full endpoint list

- `GET /login?address=...&message=...`
- `POST /login/signMessage`
- `POST /login/testAuthenticate`
- `POST /login/testHash`
- `POST /userVerified/add-user`
- `DELETE /userVerified/remove-user`
- `POST /userVerified/add-petition`
- `GET /userVerified/pending-user/:index`
- `GET /userVerified/is-verified/:userAddress`
- `POST /certificationVerified/certify`
- `POST /certificationVerified/certify-async`
- `GET /certificationVerified/getCertificate/:TransactionHash`
- `GET /certificationVerified/getCertificateData/:TransactionHash`
- `GET /node/estado-red`
- `GET /node/api/estado-red`

## Full workflow (copy/paste)

```bash
# from repository root
docker compose -f docker-compose.dev.yml up -d --build

cd project
npm install

# create/edit .env with PRIVATE_KEY and JSON_RPC_URL
npm run compile
npm run deploy:local
npm run start
```

## Stop or restart

Stop network:

```bash
docker compose -f docker-compose.dev.yml down
```

Stop network and remove local volumes/data:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Deploy to remote network

There is a script for the `production` network (defined in `hardhat.config.ts`):

```bash
cd project
npm run deploy:prod
```

## Troubleshooting

- `EADDRINUSE` on port 3000:
  - Change `PORT` in `.env` or free the port.
- RPC connection error:
  - Verify Docker is running and `JSON_RPC_URL` is correct.
- Signing/transaction error:
  - Check `PRIVATE_KEY` and ensure it has funds on the local network.
- Contract changes not reflected:
  - Run `npm run compile` and then `npm run deploy:local`.
