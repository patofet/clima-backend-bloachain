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

## Nota de seguridad

No publiques claves privadas reales en GitHub.
Si alguna clave se expuso, rotala inmediatamente y usa una nueva.
