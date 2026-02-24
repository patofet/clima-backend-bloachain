import os
import uuid
import sha3
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
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
TPS_STEPS = [10000]
REPEATS = 10          # How many times to repeat each test for averaging
COOLDOWN = 5         # Seconds to wait between repeats
CDF_TARGET_TPS = 50  # TPS to use for CDF graph (must be in TPS_STEPS)
SLA_LATENCY_THRESHOLD = 30  # seconds — txs slower than this count as SLA failures
MAX_WORKERS = 1500

# --- Shared session with connection pooling and retries ---
def create_session():
    s = requests.Session()
    # Retry on connection errors AND read timeouts
    retry = Retry(
        total=3,
        backoff_factor=1,          # 1s, 2s, 4s between retries
        connect=3,                  # retry on connection errors
        read=3,                     # retry on read timeouts
        status_forcelist=[502, 503, 504],
        allowed_methods=["GET", "POST"],  # allow POST retries too
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=200, pool_maxsize=1000)
    s.mount("http://", adapter)
    return s

SESSION = create_session()

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
        response_login = SESSION.get(login_url, timeout=(30, 120))
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
        
        response_certify = SESSION.post(certify_url, headers=headers, json=data, timeout=120)
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
            msg = f"Benchmark_{uuid.uuid4().hex[:12]}"
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
             resp = SESSION.post(f"{BASE_URL}/userVerified/add-user", 
                           headers={"Content-Type": "application/json", "Authorization": f"Basic {b64_cred}"},
                           json={"userAddress": pub}, timeout=120)
             
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
    hockey_stick_data = [] # (TPS, Median Latency)
    success_rate_data = [] # (TPS, Success Rate %)
    sla_rate_data = []     # (TPS, SLA-compliant Rate %)
    effective_tps_data = [] # (TPS, Effective TPS)
    all_latencies_for_cdf = [] # List of latencies from a specific run

    print(f"\n--- Starting Benchmark (x{REPEATS} repeats, {COOLDOWN}s cooldown) ---\n")

    # Warmup: send a few requests to warm up connections, server JIT, and nonce cache
    print("🔥 Warmup: sending 5 requests to warm up the server...")
    warmup_results = run_load_test(5, pub, pk)
    warmup_ok = sum(1 for r in warmup_results if r.get("success"))
    print(f"🔥 Warmup done: {warmup_ok}/5 OK")
    time.sleep(COOLDOWN)
    print()

    for tps in TPS_STEPS:
        run_latencies = []
        run_success_rates = []
        all_errors = []
        cdf_latencies = []

        run_sla_rates = []
        run_effective_tps = []

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

            # SLA: count txs that succeeded AND completed within threshold
            sla_ok = sum(1 for d in data if d['success'] and d['latency'] <= SLA_LATENCY_THRESHOLD)
            sla_rate = (sla_ok / total) * 100 if total > 0 else 0

            # Effective TPS: successful txs within SLA / wall clock time
            eff_tps = sla_ok / total_time if total_time > 0 else 0

            run_latencies.append(avg_lat)
            run_success_rates.append(sr)
            run_sla_rates.append(sla_rate)
            run_effective_tps.append(eff_tps)
            cdf_latencies.extend(latencies)

            # Collect errors
            for d in data:
                if not d['success']:
                    all_errors.append(d.get('error', f"HTTP {d.get('status_code', '?')}"))

            print(f"  Run {run}/{REPEATS}: Latency={avg_lat:.4f}s | SR={sr:.0f}% | SLA({SLA_LATENCY_THRESHOLD}s)={sla_rate:.0f}% | EffTPS={eff_tps:.1f} | {total_time:.1f}s")

            if run < REPEATS:
                time.sleep(COOLDOWN)

        # Median across all runs (robust against outliers)
        med_latency = statistics.median(run_latencies) if run_latencies else 0
        med_sr = statistics.median(run_success_rates) if run_success_rates else 0
        med_sla = statistics.median(run_sla_rates) if run_sla_rates else 0
        med_eff_tps = statistics.median(run_effective_tps) if run_effective_tps else 0

        hockey_stick_data.append((tps, med_latency))
        success_rate_data.append((tps, med_sr))
        sla_rate_data.append((tps, med_sla))
        effective_tps_data.append((tps, med_eff_tps))

        if tps == CDF_TARGET_TPS:
            all_latencies_for_cdf = cdf_latencies

        print(f"▶ N={tps} | Median Latency: {med_latency:.4f}s | SR: {med_sr:.1f}% | SLA({SLA_LATENCY_THRESHOLD}s): {med_sla:.1f}% | Eff TPS: {med_eff_tps:.1f}")

        # Error breakdown
        if all_errors:
            error_counts = {}
            for reason in all_errors:
                error_counts[reason] = error_counts.get(reason, 0) + 1
            print(f"  ❌ Errores totales ({len(all_errors)} en {REPEATS} runs):")
            for reason, count in sorted(error_counts.items(), key=lambda x: -x[1]):
                print(f"     {count}x | {reason}")

        print()
        time.sleep(COOLDOWN)  # Cooldown between different TPS steps

    # --- LaTeX Output Generation ---

    print("\n\n" + "="*80)
    print("  COPY-PASTE LATEX CODE FOR OVERLEAF")
    print("="*80)

    # ─── 1. Hockey Stick Graph ───
    coords_hockey = "\n    ".join([f"({x}, {y:.4f})" for x, y in hockey_stick_data])
    max_tps = max(x for x, _ in hockey_stick_data)
    max_lat = max(y for _, y in hockey_stick_data)
    lat_ceil = int(max_lat) + 2

    print(f"""
% ═══════════════════════════════════════════════════════════
% 1. HOCKEY STICK GRAPH (Throughput vs Latency)
% ═══════════════════════════════════════════════════════════
\\begin{{tikzpicture}}
\\begin{{axis}}[
    title={{Throughput vs Transaction Latency}},
    xlabel={{Concurrent Transactions}},
    ylabel={{Average Latency (seconds)}},
    xmin=0, xmax={max_tps + 5},
    ymin=0, ymax={lat_ceil},
    grid=both,
    width=10cm, height=7cm,
    legend pos=north west
]
\\addplot[color=blue, mark=*, thick] coordinates {{
    {coords_hockey}
}};
\\end{{axis}}
\\end{{tikzpicture}}""")

    # ─── 2. CDF Graph ───
    print(f"\n% ═══════════════════════════════════════════════════════════")
    print(f"% 2. CDF OF LATENCY (N={CDF_TARGET_TPS} concurrent transactions, {REPEATS} runs)")
    print(f"% ═══════════════════════════════════════════════════════════")
    if all_latencies_for_cdf:
        sorted_lat = sorted(all_latencies_for_cdf)
        n = len(sorted_lat)

        # Generate CDF points: for each latency, CDF = rank / total
        percentiles = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100]
        cdf_points = []
        for p in percentiles:
            idx = min(int((p / 100) * (n - 1)), n - 1)
            val = sorted_lat[idx]
            cdf_points.append((val, p / 100))

        coords_cdf = "\n    ".join([f"({x:.4f}, {y:.2f})" for x, y in cdf_points])

        # Calculate P90 value for the dotted line annotation
        p90_idx = min(int(0.90 * (n - 1)), n - 1)
        p90_val = sorted_lat[p90_idx]
        xmax_cdf = max(x for x, _ in cdf_points) + 1

        print(f"""\\begin{{tikzpicture}}
\\begin{{axis}}[
    title={{Transaction Finality Consistency (N={CDF_TARGET_TPS})}},
    xlabel={{Latency (seconds)}},
    ylabel={{CDF (Cumulative Probability)}},
    xmin=0, xmax={xmax_cdf:.1f},
    ymin=0, ymax=1.1,
    ytick={{0, 0.2, 0.4, 0.6, 0.8, 1.0}},
    grid=both,
    width=10cm, height=7cm
]
\\addplot[color=green!60!black, ultra thick, smooth] coordinates {{
    {coords_cdf}
}};
\\draw[gray, dotted, thick] (axis cs:0,0.9) -- (axis cs:{p90_val:.2f},0.9) -- (axis cs:{p90_val:.2f},0);
\\node at (axis cs:{p90_val + 0.5:.2f}, 0.8) {{\\small 90\\% at {p90_val:.1f}s}};
\\end{{axis}}
\\end{{tikzpicture}}""")
    else:
        print("% No successful transactions at CDF_TARGET_TPS to generate CDF.")

    # ─── 3. Success Rate Graph ───
    coords_sr = "\n    ".join([f"({x}, {y:.1f})" for x, y in success_rate_data])
    max_sr_tps = max(x for x, _ in success_rate_data)
    min_sr = min(y for _, y in success_rate_data)
    ymin_sr = max(0, int(min_sr) - 5)

    print(f"""
% ═══════════════════════════════════════════════════════════
% 3. TRANSACTION SUCCESS RATE UNDER LOAD
% ═══════════════════════════════════════════════════════════
\\begin{{tikzpicture}}
\\begin{{axis}}[
    title={{Scalability and Fault Tolerance}},
    xlabel={{Concurrent Transactions}},
    ylabel={{Success Rate (\\%)}},
    xmin=0, xmax={max_sr_tps + 5},
    ymin={ymin_sr}, ymax=100.5,
    grid=major,
    width=10cm, height=7cm
]
\\addplot[color=red, mark=square*, thick] coordinates {{
    {coords_sr}
}};
\\end{{axis}}
\\end{{tikzpicture}}""")

    # ─── 4. SLA Compliance Rate ───
    coords_sla = "\n    ".join([f"({x}, {y:.1f})" for x, y in sla_rate_data])
    max_sla_tps = max(x for x, _ in sla_rate_data)
    min_sla = min(y for _, y in sla_rate_data)
    ymin_sla = max(0, int(min_sla) - 5)

    print(f"""
% ═══════════════════════════════════════════════════════════
% 4. SLA COMPLIANCE (Latency ≤ {SLA_LATENCY_THRESHOLD}s = success)
% ═══════════════════════════════════════════════════════════
\\begin{{tikzpicture}}
\\begin{{axis}}[
    title={{SLA Compliance (latency $\\leq$ {SLA_LATENCY_THRESHOLD}s)}},
    xlabel={{Concurrent Transactions}},
    ylabel={{SLA Compliance (\\%)}},
    xmin=0, xmax={max_sla_tps + 5},
    ymin={ymin_sla}, ymax=100.5,
    grid=major,
    width=10cm, height=7cm
]
\\addplot[color=orange, mark=triangle*, thick] coordinates {{
    {coords_sla}
}};
\\draw[gray, dashed] (axis cs:0,95) -- (axis cs:{max_sla_tps + 5},95);
\\node at (axis cs:{max_sla_tps * 0.7:.0f}, 93) {{\\small SLA Target: 95\\%}};
\\end{{axis}}
\\end{{tikzpicture}}""")

    # ─── 5. Effective TPS ───
    coords_etps = "\n    ".join([f"({x}, {y:.1f})" for x, y in effective_tps_data])
    max_etps_x = max(x for x, _ in effective_tps_data)
    max_etps_y = max(y for _, y in effective_tps_data)

    print(f"""
% ═══════════════════════════════════════════════════════════
% 5. EFFECTIVE THROUGHPUT (TPS within SLA)
% ═══════════════════════════════════════════════════════════
\\begin{{tikzpicture}}
\\begin{{axis}}[
    title={{Effective Throughput (within SLA)}},
    xlabel={{Concurrent Transactions (requested)}},
    ylabel={{Effective TPS (within {SLA_LATENCY_THRESHOLD}s)}},
    xmin=0, xmax={max_etps_x + 5},
    ymin=0, ymax={int(max_etps_y) + 5},
    grid=both,
    width=10cm, height=7cm
]
\\addplot[color=purple, mark=diamond*, thick] coordinates {{
    {coords_etps}
}};
\\end{{axis}}
\\end{{tikzpicture}}""")

    print("\n" + "="*80)
    print(f"  Benchmark completado: {len(TPS_STEPS)} pasos x {REPEATS} repeticiones")
    print("="*80)

if __name__ == "__main__":
    main()
