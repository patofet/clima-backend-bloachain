import requests
import os
import sha3
import base64
import random
import time
from eth_keys.main import PrivateKey

BASE_URL = "http://magiinterface.udg.edu:3000"

def generar_claves_ethereum(semilla_texto: str) -> dict:
    k = sha3.keccak_256()
    k.update(semilla_texto.encode('utf-8'))
    pk = PrivateKey(k.digest())
    address = pk.public_key.to_checksum_address()
    return {"private_key": pk.to_hex(), "public_key": address }

def get_login_hash_and_sign(public_address: str, private_key: str, message: str) -> dict:
    try:
        login_url = f"{BASE_URL}/login?address={public_address}&message={message}"
        print(f"Requesting: {login_url}")
        response_login = requests.get(login_url, timeout=10)
        print(f"Login Response Code: {response_login.status_code}")
        response_login.raise_for_status()
        login_data = response_login.json()
        encoded_message = login_data.get("encodedMessage")
        hash_del_servidor = login_data.get("hash")
        if not encoded_message or not hash_del_servidor:
            return {"success": False, "error": "La respuesta de /login no contenía 'encodedMessage' o 'hash'.", "details": login_data}
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
            "firma_hex": firma_hex,
            "success": True
        }

def main():
    print("--- Debug Script ---")
    
    # Try to load existing keys first to see if we can reuse a working user
    keys_file = 'project/python-scripts/ethereum_keys.txt'
    pk = None
    pub = None
    
    if os.path.exists(keys_file):
        print(f"Loading keys from {keys_file}")
        with open(keys_file, 'r') as f:
            linea_privada = f.readline()
            linea_publica = f.readline()
            pk = linea_privada.split(': ')[1].strip()
            pub = linea_publica.split(': ')[1].strip()
            print(f"Loaded User: {pub}")
    else:
        print("No existing keys file found. Generating new user.")
        seed = random.randint(0, 999999)
        keys = generar_claves_ethereum(f"debug_user_{seed}")
        pk = keys['private_key']
        pub = keys['public_key']
        print(f"Generated User: {pub}")

    # Register (Always try to register/verify, even if loaded, to ensure it's allowed)
    print("Registering/Verifying...")
    # Retry logic for registration
    max_retries = 3
    for i in range(max_retries):
        login_data = get_login_hash_and_sign(pub, pk, "addAddress")
        if not login_data.get("success"):
            print(f"Registration Login Step Failed: {login_data}")
            return

        cred = f"{login_data.get('encoded_message')}:{login_data.get('firma_hex')}"
        b64_cred = base64.b64encode(cred.encode("utf-8")).decode("utf-8")
        
        try:
             resp = requests.post(f"{BASE_URL}/userVerified/add-user", 
                           headers={"Content-Type": "application/json", "Authorization": f"Basic {b64_cred}"},
                           json={"userAddress": pub}, timeout=10)
             if resp.status_code == 200 or resp.status_code == 201:
                 print("Registration Successful.")
                 break
             elif "already verified" in resp.text:
                 print("User is already verified. Proceeding.")
                 break
             else:
                 print(f"Registration Attempt {i+1} Failed: {resp.status_code} {resp.text}")
                 if i < max_retries - 1:
                     time.sleep(2)
        except Exception as e:
             print(f"Registration Exception: {e}")
             
    # Certify
    print("Certifying...")
    msg = f"Debug_Msg_{random.randint(0, 1000)}"
    start = time.time()
    
    login_data_cert = get_login_hash_and_sign(pub, pk, msg)
    if not login_data_cert.get("success"):
        print(f"Certify Login Step Failed: {login_data_cert}")
        return

    cred_cert = f"{login_data_cert.get('encoded_message')}:{login_data_cert.get('firma_hex')}"
    cred_cert_b64 = base64.b64encode(cred_cert.encode("utf-8")).decode("utf-8")
    
    certify_url = f"{BASE_URL}/certificationVerified/certify"
    headers = { "Content-Type": "application/json", "Authorization": f"Basic {cred_cert_b64}" }
    data = { "certifiedString": msg, "description": msg }
    
    try:
        resp = requests.post(certify_url, headers=headers, json=data, timeout=10)
        print(f"Certify Response: {resp.status_code} {resp.text}")
        print(f"Latency: {time.time() - start}")
    except Exception as e:
        print(f"Certify Exception: {e}")

if __name__ == "__main__":
    main()
