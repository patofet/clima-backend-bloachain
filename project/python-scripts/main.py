import sha3 # pip install safe-pysha3
from eth_keys.main import PrivateKey # pip install eth-keys

def generar_claves_ethereum_alternativa(semilla_texto: str) -> dict:
    k = sha3.keccak_256()
    k.update(semilla_texto.encode('utf-8'))
    pk = PrivateKey(k.digest())
    address = pk.public_key.to_checksum_address()

    return {"private_key": pk.to_hex(), "public_key": address }

# --- Ejemplo de uso ---
if __name__ == "__main__":
    claves = generar_claves_ethereum_alternativa("esta es mi frase secreta para generar claves2")
    
    print(f"Clave Privada: {claves['private_key']}")
    print(f"Dirección Ethereum: {claves['public_key']}")
