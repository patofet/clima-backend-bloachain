key=$(openssl ecparam -name secp256k1 -genkey -noout | openssl ec -text -noout)
pub=$(echo "$key" | grep pub -A 5 | tail -n +2 | tr -d '\n[:space:]:' | sed 's/^04//')
priv=$(echo "$key" | grep priv -A 3 | tail -n +2 | tr -d '\n[:space:]:' | sed 's/^00//')
address=$(echo "$pub" | keccak-256sum -x -l | tr -d ' -' | tail -c 41)

# Mostrar resultados
echo "Clave pública: $pub"
echo "Clave privada: $priv"
echo "Dirección: $address"
