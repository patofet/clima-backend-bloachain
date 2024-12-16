import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

export let options = {
  stages: [
    { duration: '10s', target: 10 }, // Subir hasta 10 usuarios concurrentes en 10 segundos
    { duration: '20s', target: 50 }, // Mantener 50 usuarios durante 20 segundos
    { duration: '10s', target: 0 },  // Reducir la carga a 0 usuarios en 10 segundos
  ],
};

function randomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export default function () {
    //const url = "http://84.88.154.234:3000";
    const url = "http://localhost:3000";
    const address = "0xbb678ed4adb678bad4b8f7203135ae1854463a7f";
    const message = randomString(50) // Random string
  // Prueba 1: /login (GET)
  let loginRes = http.get(
    url + '/login?address=' + address + '&message=' + message,
  );
  check(loginRes, {
    'login: status 200': (r) => r.status === 200,
    'login: contiene hash': (r) => r.json().hasOwnProperty('hash'),
    'login: contiene encodedMessage': (r) => r.json().hasOwnProperty('encodedMessage')
  });
  const loginData = loginRes.json();
  const { hash, encodedMessage } = loginData;
  // Prueba 2: /login/signMessage (POST)
  let signMessageData = JSON.stringify({
    hash,
    key: "bbd734bd28112c4c4f7e73571074ec8b5d3601f744cee7d166ac4a61558a753d",
  });
  let signMessageHeaders = { 'Content-Type': 'application/json' };
  let signMessageRes = http.post(
    url + '/login/signMessage',
    signMessageData,
    { headers: signMessageHeaders }
  );
  check(signMessageRes, {
    'signMessage: status 200': (r) => r.status === 200,
    'signMessage: contiene respuesta válida': (r) => r.body !== ''
  });

  const signMessage = signMessageRes.body
  const user = encodedMessage
  const password = signMessage
  const authorizationBasic = encoding.b64encode(`${user}:${password}`);
  // Prueba 3: /certification/certify-async (POST)
  let certifyData = JSON.stringify({
    certifiedString: randomString(100),
    description: randomString(200),
  });
  let certifyHeaders = {
    'Content-Type': 'application/json',
    Authorization:
      'Basic ' + authorizationBasic,
  };
  let certifyRes = http.post(
    url + '/certification/certify-async',
    certifyData,
    { headers: certifyHeaders }
  );
  const success = check(certifyRes, {
    'certify: status 200': (r) => r.status === 200,
    'signMessage: contiene respuesta válida': (r) => r.body !== ''
  });
  if (!success) {
    console.error(`Certify failed. Status: ${certifyRes.status}, Response: ${certifyRes.body}`);
}
  sleep(1); // Esperar 1 segundo entre iteraciones
}
