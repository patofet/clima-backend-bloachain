import csv
import time
import requests
import json
import urllib.parse
import base64
from eth_account import Account, messages
from web3 import Web3

SLEEP_BETWEEN_CALLS = 60
ARCHIVO_CSV = '/Users/jobchain/IdeaProjects/arlab-blockchain/Data electriques/dades_minut.csv'
ENDPOINT_BASE = 'http://localhost:3000'
BLOCKCHAIN_PUBLIC_ADDRESS = '0xbb678ed4adb678bad4b8f7203135ae1854463a7f'
BLOCKCHAIN_PRIVATE_KEY = 'bbd734bd28112c4c4f7e73571074ec8b5d3601f744cee7d166ac4a61558a753d'

def obtener_hash(message):
    try:
        response = requests.get(f"{ENDPOINT_BASE}/login?address={BLOCKCHAIN_PUBLIC_ADDRESS}&message={message}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error en /login: {e}")
        return None

def firmar_mensaje(hash):
    try:
        response = requests.post(
            f"{ENDPOINT_BASE}/login/signMessage", 
            headers={'Content-Type': 'application/json'}, 
            data=json.dumps({"hash": hash, "key": BLOCKCHAIN_PRIVATE_KEY})
            )
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error en /login/signMessage: {e}")
        return None

def firmar_mensaje_local(hash):
    try:
        message_to_sign = messages.encode_defunct(text=hash)
        signed_message = Account.sign_message(message_to_sign, private_key=BLOCKCHAIN_PRIVATE_KEY)
        return "0x" + signed_message.signature.hex()
    except Exception as e:
        print(f"Error al firmar el mensaje: {e}")
        return None

def certificar(certified_string, description, authorization):
    try:
        response = requests.post(
            f"{ENDPOINT_BASE}/certification/certify",
            headers={'Content-Type': 'application/json', 'Authorization': authorization},
            data=json.dumps({"certifiedString": certified_string, "description": description})
        )
        response.raise_for_status()
        try:
            data = response.json()
            return data
        except json.JSONDecodeError:
            print("Error: Respuesta no es JSON. Texto de la respuesta:", response.text)
            return response.text

    except requests.exceptions.RequestException as e:
        print(f"Error en /certification/certify: {e}")
        try:
            error_data = response.json()
            err_obj = error_data.get('object', {})
            reason = err_obj.get('reason')
            if reason == 'Esta cadena ya ha sido certificada.':
                print("Esta cadena ya ha sido certificada.")
                return reason
            elif err_obj:
                print("Error object:", err_obj)
                return err_obj
            else:
                print("Error data:", error_data)
                return error_data
        except json.JSONDecodeError:
            print("Error al decodificar JSON de error. Texto de la respuesta:", response.text)
            return response.text
        return None
    

def leer_y_enviar_datos():
    with open(ARCHIVO_CSV, 'r') as archivo:
        lector_csv = csv.DictReader(archivo)
        for fila in lector_csv:
            fila['date'] = fila.pop('')
            message = json.dumps(fila)
            login_data = obtener_hash(message)
            hash_to_sign = login_data.get('hash')
            encoded_message = login_data.get('encodedMessage')
            if hash_to_sign:
                hash_signed = firmar_mensaje_local(hash_to_sign)
                if hash_signed:
                    authorization = "Basic " + base64.b64encode((encoded_message + ":" + hash_signed).encode('utf-8')).decode('utf-8')
                    resultado_certificacion = certificar(message, "desc", authorization)
                    if resultado_certificacion:
                        print(f"Certificación exitosa: {resultado_certificacion}")
                    else:
                        print("Error en la certificación.")
                else:
                    print("Error al firmar el mensaje.")
            else:
                print("Error al obtener el hash.")
            time.sleep(SLEEP_BETWEEN_CALLS)

if __name__ == "__main__":
    leer_y_enviar_datos()