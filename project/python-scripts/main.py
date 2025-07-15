# pip install requests eth-account safe-pysha3 eth-keys
import sha3
import requests
import base64
import random
from eth_keys.main import PrivateKey

base_url = "http://magiinterface.udg.edu:3000"

def generar_claves_ethereum_alternativa(semilla_texto: str) -> dict:
    k = sha3.keccak_256()
    k.update(semilla_texto.encode('utf-8'))
    pk = PrivateKey(k.digest())
    address = pk.public_key.to_checksum_address()
    return {"private_key": pk.to_hex(), "public_key": address }

def get_login_hash_and_sign(public_address: str, private_key: str, message: str) -> dict:
    try:
        login_url = f"{base_url}/login?address={public_address}&message={message}"
        response_login = requests.get(login_url)
        response_login.raise_for_status()
        login_data = response_login.json()
        encoded_message = login_data.get("encodedMessage")
        hash_del_servidor = login_data.get("hash")
        if not encoded_message or not hash_del_servidor:
            return {"success": False, "error": "La respuesta de /login no contenía 'encodedMessage' o 'hash'."}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"Error en la petición a /login: {e}"}

    message_bytes = hash_del_servidor.encode('utf-8')
    prefix = b"\x19Ethereum Signed Message:\n"
    message_len = str(len(message_bytes)).encode('utf-8')
    message_a_hashear = prefix + message_len + message_bytes
    k = sha3.keccak_256()
    k.update(message_a_hashear)
    hash_final_a_firmar = k.digest()
    if private_key.startswith('0x'):
        pk_bytes = bytes.fromhex(private_key[2:])
    else:
        pk_bytes = bytes.fromhex(private_key)
    pk = PrivateKey(pk_bytes)
    firma = pk.sign_msg_hash(hash_final_a_firmar)
    firma_hex = firma.to_hex()
    return {
            "encoded_message": encoded_message, 
            "firma_hex": firma_hex
        }

def registrar_usuario(public_address: str, private_key: str) -> dict:
    login_data = get_login_hash_and_sign(public_address, private_key, "addAddress")

    credenciales = f"{login_data.get("encoded_message")}:{login_data.get("firma_hex")}"
    credenciales_bytes = credenciales.encode("utf-8")
    credenciales_base64 = base64.b64encode(credenciales_bytes).decode("utf-8")
    add_user_url = f"{base_url}/userVerified/add-user"
    headers = { "Content-Type": "application/json", "Authorization": f"Basic {credenciales_base64}" }
    data = { "userAddress": public_address }
    try:
        response_add_user = requests.post(add_user_url, headers=headers, json=data)
        response_add_user.raise_for_status()
        return {
            "success": True, 
            "status_code": response_add_user.status_code, 
            "response": response_add_user.json()
        }
    except requests.exceptions.RequestException as e:
        if e.response is not None:
            status_code = e.response.status_code
            try:
                error_details = e.response.json()
            except requests.exceptions.JSONDecodeError:
                error_details = e.response.text
            return {
                "success": False,
                "error": "Error HTTP del servidor en la petición a /certify.",
                "status_code": status_code,
                "details": error_details
            }
        else:
            return {
                "success": False,
                "error": "Error de conexión o de red.",
            "details": str(e) # Damos el texto del error de red para depuración.
        }

def certify_string(public_address: str, private_key: str, message: str) -> dict:
    login_data = get_login_hash_and_sign(public_address, private_key, message)

    credenciales = f"{login_data.get("encoded_message")}:{login_data.get("firma_hex")}"
    credenciales_bytes = credenciales.encode("utf-8")
    credenciales_base64 = base64.b64encode(credenciales_bytes).decode("utf-8")

    certify_url = f"{base_url}/certificationVerified/certify"
    headers = { "Content-Type": "application/json", "Authorization": f"Basic {credenciales_base64}" }
    data = { "certifiedString": message, "description": message }
    try:
        response_certify = requests.post(certify_url, headers=headers, json=data)
        response_certify.raise_for_status()
        return {
            "success": True, 
            "status_code": response_certify.status_code, 
            "response": response_certify.json()
        }
    except requests.exceptions.RequestException as e:
        if e.response is not None:
            status_code = e.response.status_code
            try:
                error_details = e.response.json()
            except requests.exceptions.JSONDecodeError:
                error_details = e.response.text
            return {
                "success": False,
                "error": "Error HTTP del servidor en la petición a /certify.",
                "status_code": status_code,
                "details": error_details
            }
        else:
            return {
                "success": False,
                "error": "Error de conexión o de red.",
            "details": str(e) # Damos el texto del error de red para depuración.
        }
    
# --- Ejemplo de uso ---
if __name__ == "__main__":
    numero_entero = random.randint(0, 9999999999)
    claves = generar_claves_ethereum_alternativa(f"esta es mi frase secreta para generar claves {numero_entero}")
    
    print(f"Clave Privada: {claves['private_key']}")
    print(f"Dirección Ethereum: {claves['public_key']}")

    res_add_user = registrar_usuario(claves['public_key'], claves['private_key'])
    print(res_add_user)

    res_certify = certify_string(claves['public_key'], claves['private_key'], f"cccc {numero_entero}")
    print(res_certify)

