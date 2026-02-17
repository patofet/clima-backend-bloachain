### Explicación de los Campos en el Archivo `config/genesis.json`

1. **`config`**: Esta sección contiene la configuración de la red de blockchain:

- **`chainId`**: El identificador único para tu red blockchain (en este caso, `1337`).
- **`constantinoplefixblock`**: Número de bloque que activa la actualización de Constantinopla.
- **`contractSizeLimit`**: El tamaño máximo de los contratos de código en la red blockchain.
- **`ibft2`**: Los parámetros específicos del consenso IBFT 2.0.
  - **`blockperiodseconds`**: El tiempo que transcurre entre los bloques (2 segundos).
  - **`epochlength`**: La longitud de la época (número de bloques antes de cambiar de líder o validar transacciones).
  - **`requesttimeoutseconds`**: El tiempo de espera para las solicitudes de consenso.

2. **`nonce`**: Un número único que se utiliza para crear un hash para el bloque de génesis.

3. **`timestamp`**: Marca de tiempo para la creación del bloque génesis.

4. **`extraData`**: Contiene la información de los validadores iniciales de IBFT 2.0. Este campo puede ser generado utilizando las claves públicas de los nodos validadores iniciales.

5. **`gasLimit`**: El límite de gas para cada bloque.

6. **`difficulty`**: La dificultad de minería para el bloque génesis (usualmente es `0x1` en IBFT 2.0 ya que no hay minería).

7. **`mixHash`**: Un campo específico que debe ser el hash "0x63746963616c646967657374" para IBFT 2.0.

8. **`coinbase`**: Dirección de la cuenta de recompensa del bloque, generalmente "0x0" en el bloque génesis.

9. **`alloc`**: Preasignación de fondos a direcciones de cuenta. Puedes añadir las direcciones que deseas que tengan un balance inicial. Por ejemplo:

- `"0x1e6e06f02e1b8c303fae641b47640d5d4fae844d": { "balance": "0x1000000000000000000000000" }`

10. **`number`**: Número de bloque (siempre `0x0` para el bloque génesis).

11. **`gasUsed`**: Cantidad de gas usado en el bloque génesis (usualmente `0x0`).

12. **`parentHash`**: Hash del bloque padre; en el bloque génesis, siempre es `0x000...000`.

### Consideraciones Adicionales

- **`extraData`**: Este campo requiere una configuración específica basada en los validadores que usarás. Para obtener el valor correcto, utiliza la herramienta Besu para generar la configuración de `extraData` utilizando las claves públicas de los nodos validadores. Puedes utilizar el comando `besu operator generate-blockchain-config` para generar este valor automáticamente.

- **Direcciones de Cuenta en `alloc`**: Asegúrate de usar direcciones de cuenta válidas y que corresponden a las claves que planeas utilizar para interactuar con tu red.

### Configuración de los Validadores

Para configurar los validadores correctamente, asegúrate de que cada nodo validador tenga su propio archivo de claves en la carpeta de datos que apuntará en su configuración. Además, cada nodo debe estar configurado para participar en la red utilizando IBFT 2.0.

Este `genesis.json` es un buen punto de partida para crear una red blockchain privada con IBFT 2.0 en Hyperledger Besu. Puedes modificar y ajustar las configuraciones de acuerdo con tus necesidades específicas.

docker rm -f $(docker ps -aq)
docker rmi -f $(docker images -aq)
docker volume rm $(docker volume ls -q)
docker volume rm $(docker volume ls -q)
docker network prune -f
docker system prune -a --volumes -f
sudo rm -rf /home/dappnode/SmartChain/data
mkdir /home/dappnode/SmartChain/data
mkdir /home/dappnode/SmartChain/data/config
chmod 777 -R /home/dappnode/SmartChain
docker build -t melchor --build-arg PKEY=node2Key -f Dockerfile .
docker run -d --name melchor --restart=always -v ~/SmartChain/data:/opt/besu/data -v ~/SmartChain/config:/opt/besu/config -p 8545:8545 -p 8546:8546 -p 30303:30303 -p 30303:30303/udp melchor --logging=INFO --min-gas-price=0 --data-path=/opt/besu/data --genesis-file=/opt/besu/genesis.json --node-private-key-file=/opt/besu/key --rpc-http-enabled --graphql-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8545 --rpc-ws-enabled --rpc-ws-host=0.0.0.0 --rpc-ws-port=8545 --p2p-port=30303 --host-allowlist=_ --tx-pool-max-future-by-sender=200 --rpc-http-cors-origins=_ --rpc-http-api=ETH,NET,IBFT,WEB3 --rpc-ws-api=ETH,NET,IBFT,WEB3 --p2p-host=84.88.154.163 --tx-pool-min-gas-price=0 --metrics-enabled

docker rm -f $(docker ps -aq)
docker rmi -f $(docker images -aq)
docker volume rm $(docker volume ls -q)
docker volume rm $(docker volume ls -q)
docker network prune -f
docker system prune -a --volumes -f
sudo rm -rf /home/dappnodes/SmartChain/data
mkdir /home/dappnodes/SmartChain/data
mkdir /home/dappnodes/SmartChain/data/config
chmod 777 -R /home/dappnodes/SmartChain
docker build -t gaspar --build-arg PKEY=node3Key -f Dockerfile .
docker run -d --name gaspar --restart=always -v ~/SmartChain/data:/opt/besu/data -v ~/SmartChain/config:/opt/besu/config -p 8545:8545 -p 8546:8546 -p 30303:30303 -p 30303:30303/udp gaspar --logging=INFO --min-gas-price=0 --data-path=/opt/besu/data --genesis-file=/opt/besu/genesis.json --node-private-key-file=/opt/besu/key --rpc-http-enabled --graphql-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8545 --rpc-ws-enabled --rpc-ws-host=0.0.0.0 --rpc-ws-port=8545 --p2p-port=30303 --host-allowlist=_ --tx-pool-max-future-by-sender=200 --rpc-http-cors-origins=_ --rpc-http-api=ETH,NET,IBFT,WEB3 --rpc-ws-api=ETH,NET,IBFT,WEB3 --p2p-host=84.88.154.219 --tx-pool-min-gas-price=0 --metrics-enabled

docker rm -f $(docker ps -aq)
docker rmi -f $(docker images -aq)
docker volume rm $(docker volume ls -q)
docker volume rm $(docker volume ls -q)
docker network prune -f
docker system prune -a --volumes -f
sudo rm -rf /home/dappnode/SmartChain/data
mkdir /home/dappnode/SmartChain/data
mkdir /home/dappnode/SmartChain/data/config
chmod 777 -R /home/dappnode/SmartChain
docker build -t baltazar --build-arg PKEY=node1Key -f Dockerfile .
docker run -d --name baltazar --restart=always -v ~/SmartChain/data:/opt/besu/data -v ~/SmartChain/config:/opt/besu/config -p 8545:8545 -p 8546:8546 -p 30303:30303 -p 30303:30303/udp baltazar --logging=INFO --min-gas-price=0 --data-path=/opt/besu/data --genesis-file=/opt/besu/genesis.json --node-private-key-file=/opt/besu/key --rpc-http-enabled --graphql-http-enabled --rpc-http-host=0.0.0.0 --rpc-http-port=8545 --rpc-ws-enabled --rpc-ws-host=0.0.0.0 --rpc-ws-port=8545 --p2p-port=30303 --host-allowlist=_ --tx-pool-max-future-by-sender=200 --rpc-http-cors-origins=_ --rpc-http-api=ETH,NET,IBFT,WEB3 --rpc-ws-api=ETH,NET,IBFT,WEB3 --p2p-host=84.88.154.252 --tx-pool-min-gas-price=0 --metrics-enabled

{{
"config": {
"chainId": 1714,
"cancunTime": 0,
"pragueTime": 1771286400,
"osakaTime": 1771286400,
"contractSizeLimit": 2147483647,
"zeroBaseFee": true,
"ibft2": {
"blockperiodseconds": 2,
"epochlength": 30000,
"requesttimeoutseconds": 4
},
"discovery": {
"bootnodes": [
"enode://edfe064b5c4566357655dbd5034b179f2013e138bef0cfd73f24c3889bbca1e9388494ba35ae465d1ccc0c83f4331521d23503e96d451577f7f8cdc6924c0aed@84.88.154.163:30303", // Melchor
"enode://c2822cd2ae9944d599eea604ee027cc2eb8fd53bb3641d6c2ed9f056adf67088a4e986b51f130eefed8e771958b62a3980e6b591ffc93a0eb4916d2c8c13afe7@84.88.154.252:30303", // Baltazar
"enode://17640b1d69a476dc225de4d083b80630d5e7fb4995e77f8eee940d6397e9e37ba7bc9206f8be1aa3848b7a1d34cb8abb208ce34fd1b15b437d0c193e89cdede2@84.88.154.219:30303" // Gaspar
]
}
},
"nonce": "0x0",
"timestamp": "0x58ee40ba",
"extraData": "0xf869a00000000000000000000000000000000000000000000000000000000000000000f83f94220cf77b111ab04f3b2ea51a109bedebd6a06964948f56a139b23358c79aa845461f4f48b40fc6709b949c7a4d043a6da8151600c40f200821ad30c47481808400000000c0",
"gasLimit": "0x1fffffffffffff",
"difficulty": "0x1",
"mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
"coinbase": "0x0000000000000000000000000000000000000000",
"alloc": {
"220cf77b111ab04f3b2ea51a109bedebd6a06964": {
"privateKey": "a6111af4d1068a00cdf96abf12f2540bcf531deb3aaae211232059a9c704757e",
"comment": "private key and this comment are ignored. In a real chain, the private key should NOT be stored",
"balance": "90000000000000000000000"
},
"8f56a139b23358c79aa845461f4f48b40fc6709b": {
"privateKey": "13939dea2d45c8468baaa31962014c20946c1f934b141eeab3d399790ef2a461",
"comment": "private key and this comment are ignored. In a real chain, the private key should NOT be stored",
"balance": "90000000000000000000000"
},
"9c7a4d043a6da8151600c40f200821ad30c47481": {
"privateKey": "1d8742a89e509e7c92e7fee6c8ebc82ec588dacdff9b8711783cde15a8dff4ce",
"comment": "private key and this comment are ignored. In a real chain, the private key should NOT be stored",
"balance": "90000000000000000000000"
}
}
}
