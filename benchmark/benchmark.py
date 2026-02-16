import os
import sha3
import requests
import base64
import random
import time
import concurrent.futures
import statistics
import numpy as np
import threading
from eth_keys.main import PrivateKey

# --- Configuration ---
BASE_URL = "http://magiinterface.udg.edu:3000"
TPS_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
REPEATS = 3          # How many times to repeat each test for averaging
COOLDOWN = 3         # Seconds to wait between repeats
CDF_TARGET_TPS = 5   # TPS to use for CDF graph
MAX_WORKERS = 500 # Increased to handle high latency at high TPS (50 TPS * 6s latency = 300+ workers needed)

# --- Helper Functions (copied and adapted from main.py) ---

def generar_claves_ethereum(semilla_texto: str) -> dict:
    k = sha3.keccak_256()
    k.update(semilla_texto.encode('utf-8'))
    pk = PrivateKey(k.digest())
    address = pk.public_key.to_checksum_address()
    return {"private_key": pk.to_hex(), "public_key": address }

def get_login_hash_and_sign(public_address: str, private_key: str, message: str) -> dict:
    try:
        login_url = f"{BASE_URL}/login?address={public_address}&message={message}"
        response_login = requests.get(login_url, timeout=5)
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
            "firma_hex": firma_hex,
            "success": True
        }

# Cache credentials to avoid signing every single request if possible, 
# but for certify_string we need to sign the specific message if the API requires unique signatures per tx.
# Looking at main.py, certify_string takes 'message' and signs it. 
# If existing API allows reusing session, we should. But based on `certify_string` implementation,
# it calls `get_login_hash_and_sign(..., message)` which implies the message IS the content to be certified
# and it needs to be signed.
# However, the `certify_string` in main.py does:
# 1. Login to get hash (server challenge?) or just sign the message?
#    Wait, `get_login_hash_and_sign` calls `/login?address=...&message=...`.
#    It seems it gets a server-provided hash to sign?
#    If so, this acts as a nonce/challenge.
#    Then it uses the signature to call `/certify`.
# This means 2 requests per transaction (1 login/nonce, 1 certify).
# This is heavy. Let's optimize if possible, but for now stick to the logic.

def certify_string_measured(public_address: str, private_key: str, message: str) -> dict:
    start_time = time.time()
    try:
        # Step 1: Get Hash/Nonce
        login_data = get_login_hash_and_sign(public_address, private_key, message)
        if not login_data.get("success", False):
             end_time = time.time()
             return {"success": False, "latency": end_time - start_time, "error": login_data.get("error")}

        # Step 2: Certify
        credenciales = f"{login_data.get('encoded_message')}:{login_data.get('firma_hex')}"
        credenciales_bytes = credenciales.encode("utf-8")
        credenciales_base64 = base64.b64encode(credenciales_bytes).decode("utf-8")

        certify_url = f"{BASE_URL}/certificationVerified/certify"
        headers = { "Content-Type": "application/json", "Authorization": f"Basic {credenciales_base64}" }
        data = { "certifiedString": message, "description": message }
        
        response_certify = requests.post(certify_url, headers=headers, json=data, timeout=3000)
        end_time = time.time()
        
        if response_certify.status_code == 200 or response_certify.status_code == 201:
             return {"success": True, "latency": end_time - start_time, "status_code": response_certify.status_code}
        else:
             # Capture the error body from the server
             try:
                 error_body = response_certify.json()
                 error_detail = error_body.get("error", response_certify.text[:200])
             except Exception:
                 error_detail = response_certify.text[:200]
             return {"success": False, "latency": end_time - start_time, "status_code": response_certify.status_code, "error": error_detail}

    except requests.exceptions.RequestException as e:
        end_time = time.time()
        return {"success": False, "latency": end_time - start_time, "error": str(e)}

def run_load_test(num_requests, public_key, private_key):
    print(f"Running load test: {num_requests} requests in parallel...")
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        
        # Launch all requests at once
        for i in range(num_requests):
            msg = f"Benchmark_{num_requests}_{i}_{random.randint(0, 100000)}"
            futures.append(executor.submit(certify_string_measured, public_key, private_key, msg))
        
        print(f"  → {num_requests} requests lanzadas, esperando respuestas...")
        
        # Wait for all to complete
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result(timeout=120)
                results.append(res)
            except Exception as e:
                results.append({"success": False, "latency": 0, "error": str(e)})
                
    return results

# --- Main Benchmark Control ---

def main():
    # 1. Setup User
    print("--- Setting up Benchmark User ---")
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
        keys = generar_claves_ethereum(f"benchmark_user_{seed}")
        pk = keys['private_key']
        pub = keys['public_key']
        print(f"Generated User: {pub}")
    
    # Register user (needed to post data)
    print(f"Registering/Verifying user {pub}...")
    
    # Retry logic for registration
    max_retries = 3
    registered = False
    
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
                 print("User registered successfully.")
                 registered = True
                 break
             elif "already verified" in resp.text:
                 print("User is already verified. Proceeding.")
                 registered = True
                 break
             else:
                 print(f"Registration Attempt {i+1} Failed: {resp.status_code} {resp.text}")
                 if i < max_retries - 1:
                     time.sleep(2)
        except Exception as e:
             print(f"Registration Exception: {e}")
             if i < max_retries - 1:
                 time.sleep(2)
    
    if not registered and "already verified" not in str(resp.text if 'resp' in locals() else ""):
        print("Failed to register/verify user. Aborting benchmark.")
        return

    # Data Stores
    hockey_stick_data = [] # (TPS, Avg Latency)
    success_rate_data = [] # (TPS, Success Rate %)
    all_latencies_for_cdf = [] # List of latencies from a specific run

    print(f"\n--- Starting Benchmark (x{REPEATS} repeats, {COOLDOWN}s cooldown) ---\n")

    for tps in TPS_STEPS:
        run_latencies = []
        run_success_rates = []
        all_errors = []
        cdf_latencies = []

        for run in range(1, REPEATS + 1):
            start_time = time.time()
            data = run_load_test(tps, pub, pk)
            total_time = time.time() - start_time

            latencies = [d['latency'] for d in data if d['success']]
            failures = sum(1 for d in data if not d['success'])
            total = len(data)
            success_count = total - failures

            avg_lat = statistics.mean(latencies) if latencies else 0
            sr = (success_count / total) * 100 if total > 0 else 0

            run_latencies.append(avg_lat)
            run_success_rates.append(sr)
            cdf_latencies.extend(latencies)

            # Collect errors
            for d in data:
                if not d['success']:
                    all_errors.append(d.get('error', f"HTTP {d.get('status_code', '?')}"))

            print(f"  Run {run}/{REPEATS}: Latency={avg_lat:.4f}s | SR={sr:.0f}% | OK={success_count}/{total} | {total_time:.1f}s")

            if run < REPEATS:
                time.sleep(COOLDOWN)

        # Average across all runs
        avg_latency = statistics.mean(run_latencies) if run_latencies else 0
        avg_sr = statistics.mean(run_success_rates) if run_success_rates else 0

        hockey_stick_data.append((tps, avg_latency))
        success_rate_data.append((tps, avg_sr))

        if tps == CDF_TARGET_TPS:
            all_latencies_for_cdf = cdf_latencies

        print(f"▶ N={tps} | Avg Latency: {avg_latency:.4f}s | Avg Success Rate: {avg_sr:.1f}%")

        # Error breakdown
        if all_errors:
            error_counts = {}
            for reason in all_errors:
                if isinstance(reason, str) and len(reason) > 120:
                    reason = reason[:120] + "..."
                error_counts[reason] = error_counts.get(reason, 0) + 1
            print(f"  ❌ Errores totales ({len(all_errors)} en {REPEATS} runs):")
            for reason, count in sorted(error_counts.items(), key=lambda x: -x[1]):
                print(f"     {count}x | {reason}")

        print()
        time.sleep(COOLDOWN)  # Cooldown between different TPS steps

    # --- Output Generation ---

    print("\n\n=== 1. Hockey Stick Graph (Throughput vs Latency) ===")
    print("X-Axis: TPS, Y-Axis: Latency (s)")
    hockey_str = " ".join([f"({x}, {y:.4f})" for x, y in hockey_stick_data])
    print(hockey_str)

    print("\n=== 2. CDF of Latency (at TPS={}) ===".format(CDF_TARGET_TPS))
    print("X-Axis: Latency (s), Y-Axis: Percentile (0-1)")
    if all_latencies_for_cdf:
        sorted_lat = sorted(all_latencies_for_cdf)
        # Generate ~20 points for smooth curve or just dump all
        # Overleaf usually wants a reasonable number of points.
        # Let's pick percentiles: 0, 5, 10, ... 90, 95, 99, 100
        percentiles = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100]
        cdf_points = []
        for p in percentiles:
            idx = int((p / 100) * (len(sorted_lat) - 1))
            val = sorted_lat[idx]
            cdf_points.append((val, p/100))
        
        cdf_str = " ".join([f"({x:.4f}, {y})" for x, y in cdf_points])
        print(cdf_str)
    else:
        print("No successful transactions to generate CDF.")

    print("\n=== 3. Transaction Success Rate ===")
    print("X-Axis: TPS, Y-Axis: Success Rate (%)")
    success_str = " ".join([f"({x}, {y:.2f})" for x, y in success_rate_data])
    print(success_str)

if __name__ == "__main__":
    main()
