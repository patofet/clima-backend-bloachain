import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";
import encoding from "k6/encoding";

// MY_DURATION=2 MY_RATE=2 k6 run --log-format raw --quiet loadtest\ copy.js 2> tst.ttt
// Definimos una métrica para el tiempo de respuesta
const responseTimes = new Trend("response_times");
const rate = parseInt(__ENV.MY_RATE || "1");
const duration = parseInt(__ENV.MY_DURATION || "60");
export const options = {
  scenarios: {
    mi_escenario: {
      // Puedes darle el nombre que quieras al escenario
      executor: "constant-arrival-rate",
      duration: duration + "s", // Duración total
      rate: rate, // Tasa de llegada: X iteración por segundo
      timeUnit: "1s", // Unidad de tiempo para 'rate': por segundo
      preAllocatedVUs: 60 * rate, // Pre-asignar VUs inicialmente
      maxVUs: 60 * rate * 2, // Máximo de VUs (ajustado, ver explicación abajo)
      gracefulStop: "300000s",
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
  const successfull = check(certifyRes, {
    "certify: status 200": (r) => r.status === 200,
    "certifyRes: contiene transaccion": (r) =>
      r.json().hasOwnProperty("transaction"),
  });
}
export function handleSummary(data) {
  //console.log(JSON.stringify(data));
  const checks = data.root_group.checks;
  const certifyTitle = "certifyRes: contiene transaccion";
  const checkCertify = checks.find((c) => c.name === certifyTitle);

  const iterations = data.metrics.iterations.values.count;
  const iterationsPerSecond = (iterations / duration).toFixed(2);
  const certifyPasses = checkCertify.passes;
  const avg = data.metrics.response_times.values.avg;
  const min = data.metrics.response_times.values.min;
  const med = data.metrics.response_times.values.med;
  const max = data.metrics.response_times.values.max;
  const p90 = data.metrics.response_times.values["p(90)"];
  const p95 = data.metrics.response_times.values["p(95)"];
  // Duration:Iterations:Iterations per second:passes:Avg:Min:Med:Max:P90:P95
  const summaryLine = `${duration}:${iterations}:${iterationsPerSecond}:${certifyPasses}:${avg}:${min}:${med}:${max}:${p90}:${p95}`;
  // MY_DURATION=2 MY_RATE=2 k6 run --log-format raw --quiet loadtest\ copy.js 2>> tst.ttt
  console.log(summaryLine);
  return {};
}
