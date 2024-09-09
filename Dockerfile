# Utilizar la imagen oficial de Hyperledger Besu
FROM hyperledger/besu:latest

ARG PKEY=./config/pkey

# Crear directorios para los datos y la configuración
RUN mkdir -p /opt/besu
RUN mkdir -p /opt/besu/data

# Copiar archivos de configuración al contenedor
COPY ./config/genesis.json /opt/besu
COPY ./data/$PKEY /opt/besu/key

# Exponer los puertos necesarios para la red
EXPOSE 8545 8546 30303 30303/udp 8547
