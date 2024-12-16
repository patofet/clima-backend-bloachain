import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '10s', target: 0 },
  ],
};

function randomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function login(url, address, message) {
    const res = http.get(`${url}/login?address=${address}&message=${message}`);
    check(res, {
        'login: status 200': (r) => r.status === 200,
        'login: contiene hash': (r) => r.json().hasOwnProperty('hash'),
        'login: contiene encodedMessage': (r) => r.json().hasOwnProperty('encodedMessage'),
    });
    return res.json();
}

function signMessage(url, hash) {
    const data = JSON.stringify({
        hash,
        key: "bbd734bd28112c4c4f7e73571074ec8b5d3601f744cee7d166ac4a61558a753d",
    });
    const headers = { 'Content-Type': 'application/json' };
    const res = http.post(`${url}/login/signMessage`, data, { headers });
    check(res, {
        'signMessage: status 200': (r) => r.status === 200,
        'signMessage: contiene respuesta válida': (r) => r.body !== '',
    });
    return res.body;
}

function certify(url, auth, certifiedString, description) {
    const data = JSON.stringify({ certifiedString, description });
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
    };
    const res = http.post(`${url}/certification/certify-async`, data, { headers });
    check(res, {
        'certify: status 200': (r) => r.status === 200,
        'certify: contiene respuesta válida': (r) => r.body !== '',
    });
    return res.json();
}

function verifyTransaction(url, transactionHash) {
    const res = http.get(`${url}/transactions/${transactionHash}`);
    const success = check(res, {
        'transaction: status 200': (r) => r.status === 200,
        'transaction: contiene estado': (r) => r.json().hasOwnProperty('blockNumber'),
    });
    if (!success) {
      console.error(`Transaction failed. Response: ${res.body}`);
  }
    return res.json();
}

export default function () {
  //const url = "http://84.88.154.234:3000";
    const url = "http://localhost:3000";
    const address = "0xbb678ed4adb678bad4b8f7203135ae1854463a7f";
    const message = randomString(50);

    // Paso 1: Login
    const loginData = login(url, address, message);
    const { hash, encodedMessage } = loginData;

    // Paso 2: Sign Message
    const signMessageResponse = signMessage(url, hash);
    const authorizationBasic = encoding.b64encode(`${encodedMessage}:${signMessageResponse}`);

    // Paso 3: Certify
    const certifiedString = randomString(100);
    const description = randomString(200);
    const certifyResponse = certify(url, authorizationBasic, certifiedString, description);

    const transactionHash = certifyResponse.transactionHash;

    // Esperar 1 minuto antes de verificar la transacción
    sleep(60);

    // Paso 4: Verificar el estado de la transacción
    const transactionStatus = verifyTransaction(url, transactionHash);

}
