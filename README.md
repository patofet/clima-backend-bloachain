# Clima Backend Blockchain

Backend API + despliegue de contratos para una red Hyperledger Besu IBFT con Hardhat.

## Arquitectura rapida

- Red blockchain local con 3 nodos Besu via Docker Compose.
- API Node.js/Express en `project/`.
- Contratos Solidity desplegados con Hardhat Ignition (chainId `1714`).

## Requisitos

- Docker y Docker Compose (`docker compose`)
- Node.js 18+ y npm

Verifica versiones:

```bash
docker --version
docker compose version
node -v
npm -v
```

## 1) Levantar la red blockchain local

Desde la raiz del repositorio:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Comprobar nodos levantados:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

RPC principal local esperado: `http://localhost:8545`

Nodos que deben quedar levantados en local:

- `besu-validator1` (RPC: 8545, WS: 8546, P2P: 30303)
- `besu-validator2` (P2P: 30304)
- `besu-validator3` (P2P: 30305)

Comprobaciones recomendadas:

```bash
docker compose -f docker-compose.dev.yml ps
docker logs besu-validator1 --tail 50
docker logs besu-validator2 --tail 50
docker logs besu-validator3 --tail 50
```

## 2) Configurar backend y hardhat

Entrar en el proyecto Node:

```bash
cd project
npm install
```

Crear archivo de entorno `project/.env`:

```env
PRIVATE_KEY=0xTU_PRIVATE_KEY
JSON_RPC_URL=http://localhost:8545
# Opcional: varios nodos separados por coma
# JSON_RPC_URLS=http://localhost:8545,http://localhost:8546
PORT=3000
```

## 3) Compilar y desplegar contratos en local

```bash
npm run compile
npm run deploy:local
```

Al finalizar el deploy, se genera el archivo con direcciones en:

- `project/ignition/deployments/chain-1714/deployed_addresses.json`

Si ese archivo no existe, el backend no podra inicializar contratos.

## 4) Arrancar el servidor API

```bash
npm run start
```

Modo desarrollo:

```bash
npm run dev
```

Si todo va bien, la API queda escuchando en `http://localhost:3000`.

## Endpoints utiles

- Estado red (vista): `GET /node/estado-red`
- Estado red (json): `GET /node/api/estado-red`

Ejemplo:

```bash
curl http://localhost:3000/node/api/estado-red
```

## Autenticacion para endpoints protegidos

Algunas rutas usan `Authorization: Basic ...` con este formato:

`address/timestamp/message:firma`

Pasos:

1. Pedir hash al backend:

```bash
curl "http://localhost:3000/login?address=0xTU_DIRECCION&message=MI_MENSAJE"
```

Respuesta esperada: `timestamp`, `encodedMessage` y `hash`.

2. Firmar el `hash` con la clave privada del usuario (ejemplo con Node):

```bash
export USER_PK=0xTU_PRIVATE_KEY
export HASH=pega_aqui_el_hash
node -e "const {Wallet}=require('ethers'); const w=new Wallet(process.env.USER_PK); w.signMessage(process.env.HASH).then(console.log)"
```

3. Construir el header Basic:

```bash
export ADDRESS=0xTU_DIRECCION
export TIMESTAMP=pega_aqui_timestamp
export MESSAGE=MI_MENSAJE
export SIGNED=0xFIRMA_GENERADA
export AUTH=$(printf "%s" "$ADDRESS/$TIMESTAMP/$MESSAGE:$SIGNED" | base64)
```

4. Usar `Authorization: Basic $AUTH` en llamadas protegidas.

## Registrar usuario nuevo en la comunidad

Endpoint:

- `POST /userVerified/add-user`

Ejemplo:

```bash
curl -X POST "http://localhost:3000/userVerified/add-user" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "userAddress": "0xDIRECCION_DEL_USUARIO_A_REGISTRAR"
  }'
```

## Registrar nueva medicion

Endpoint:

- `POST /certificationVerified/certify`

Importante: el campo `certifiedString` debe coincidir con el `message` usado en la autenticacion.

Ejemplo:

```bash
curl -X POST "http://localhost:3000/certificationVerified/certify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d '{
    "certifiedString": "MI_MENSAJE",
    "description": "Nueva medicion de temperatura 26.4C en Girona"
  }'
```

## Lista completa de endpoints

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

## Flujo completo (copy/paste)

```bash
# desde la raiz
docker compose -f docker-compose.dev.yml up -d --build

cd project
npm install

# crea/edita .env con PRIVATE_KEY y JSON_RPC_URL
npm run compile
npm run deploy:local
npm run start
```

## Parar o reiniciar

Parar red:

```bash
docker compose -f docker-compose.dev.yml down
```

Parar red y borrar volumenes/datos locales:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Despliegue contra red remota

Existe script para red `production` (definida en `hardhat.config.ts`):

```bash
cd project
npm run deploy:prod
```

## Troubleshooting

- Error `EADDRINUSE` en puerto 3000:
  - Cambia `PORT` en `.env` o libera el puerto.
- Error de conexion RPC:
  - Verifica que Docker este levantado y que `JSON_RPC_URL` sea correcto.
- Error de firma/transacciones:
  - Revisa `PRIVATE_KEY` y que tenga fondos en la red local.
- Cambios de contratos no reflejados:
  - Ejecuta `npm run compile` y luego `npm run deploy:local`.
