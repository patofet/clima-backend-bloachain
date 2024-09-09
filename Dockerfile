# Utilizar la imagen oficial de Hyperledger Besu
FROM hyperledger/besu:latest

# Crear directorios para los datos y la configuración
RUN mkdir -p /opt/besu/data
RUN mkdir -p /opt/besu/config

# Copiar archivos de configuración al contenedor
COPY genesis.json /opt/besu/config/
COPY besu.conf /opt/besu/config/

# Exponer los puertos necesarios para la red
EXPOSE 8545 8546 30303 30303/udp 8547

# Comando para iniciar el nodo de Besu
CMD ["besu", "--config-file=/opt/besu/config/besu.conf"]
