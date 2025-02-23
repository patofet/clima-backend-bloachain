import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";
import encoding from "k6/encoding";

// Definimos una métrica para el tiempo de respuesta
const responseTimes = new Trend("response_times");

export const options = {
  scenarios: {
    mi_escenario: {
      // Puedes darle el nombre que quieras al escenario
      executor: "constant-arrival-rate",
      duration: "1s", // Duración total: 60 segundos
      rate: 2, // Tasa de llegada: 1 iteración por segundo
      timeUnit: "1s", // Unidad de tiempo para 'rate': por segundo
      preAllocatedVUs: 1000, // Pre-asignar 1 VU
      maxVUs: 1000, // Máximo de VUs (ajustado, ver explicación abajo)
      gracefulStop: "300s",
    },
  },
};

function randomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
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
  const message = randomString(50); // Random string
  // Prueba 1: /login (GET)
  let loginRes = http.get(
    url + "/login?address=" + address + "&message=" + message
  );
  check(loginRes, {
    "login: status 200": (r) => r.status === 200,
    "login: contiene hash": (r) => r.json().hasOwnProperty("hash"),
    "login: contiene encodedMessage": (r) =>
      r.json().hasOwnProperty("encodedMessage"),
  });
  const loginData = loginRes.json();
  const { hash, encodedMessage } = loginData;
  // Prueba 2: /login/signMessage (POST)
  let signMessageData = JSON.stringify({
    hash,
    key: "bbd734bd28112c4c4f7e73571074ec8b5d3601f744cee7d166ac4a61558a753d",
  });
  let signMessageHeaders = { "Content-Type": "application/json" };
  let signMessageRes = http.post(url + "/login/signMessage", signMessageData, {
    headers: signMessageHeaders,
  });
  check(signMessageRes, {
    "signMessage: status 200": (r) => r.status === 200,
    "signMessage: contiene respuesta válida": (r) => r.body !== "",
  });

  const signMessage = signMessageRes.body;
  const user = encodedMessage;
  const password = signMessage;
  const authorizationBasic = encoding.b64encode(`${user}:${password}`);
  // Prueba 3: /certification/certify (POST)
  let certifyData = JSON.stringify({
    certifiedString: randomString(100),
    description: randomString(200),
  });
  let certifyHeaders = {
    "Content-Type": "application/json",
    Authorization: "Basic " + authorizationBasic,
  };
  let certifyRes = http.post(url + "/certification/certify", certifyData, {
    headers: certifyHeaders,
    timeout: 3000000,
  });
  responseTimes.add(certifyRes.timings.duration);
  const success = check(certifyRes, {
    "certify: status 200": (r) => r.status === 200,
    "signMessage: contiene respuesta válida": (r) => r.body !== "",
  });
  if (!success) {
    console.error(
      `Certify failed. Status: ${certifyRes.status}, Response: ${certifyRes.body}`
    );
  }
}
export function handleSummary(data) {
  const iterationsPerSecond =
    data.metrics.iterations.values.count /
    (data.state.testRunDurationMs / 1000);
  const summaryLine = `${iterationsPerSecond.toFixed(2)} iters/s avg=${
    data.metrics.response_times.values.avg
  } min=${data.metrics.response_times.values.min} med=${
    data.metrics.response_times.values.med
  } max=${data.metrics.response_times.values.max} p(90)=${
    data.metrics.response_times.values["p(90)"]
  } p(95)=${data.metrics.response_times.values["p(95)"]}`;
  return { "resultados.txt": summaryLine + "\n" };
}
