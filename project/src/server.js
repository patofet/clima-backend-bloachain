const http = require("http");
const app = require("./app");

const { initializeSharedSigner, getSigner, getProvider, getTransactionDetails } = require("./sharedSigner");
const TransactionQueue = require("./TransactionQueue");

const { initCertificationVerificatedContract } = require("./contracts/CertificationVerificated");
const { initUsersVerifiedContract } = require("./contracts/UsersVerified");

const createCertificationVerifiedRouter = require("./routes/certificationVerified");
const loginRouter = require("./routes/login");
const drissaRouter = require("./routes/drissa");
const createUserRouter = require("./routes/userVerified");
const nodeStatus = require("./routes/node");

const PORT = process.env.PORT || 3000;

try {
  initializeSharedSigner();
  console.log("✅ Wallet compartida inicializada correctamente.");
} catch (error) {
  console.error("💥 ¡ERROR al inicializar la wallet compartida!", error);
  process.exit(1);
}

let signer;
try {
  signer = getSigner();
  console.log("✅ Signer compartido obtenido correctamente.");
} catch (error) {
  console.error("💥 ¡ERROR al obtener el signer compartido!", error);
  process.exit(1);
}

let certificationVerifiedContract;
let usersContract;
try {
  certificationVerifiedContract = initCertificationVerificatedContract();
  usersContract = initUsersVerifiedContract();
  console.log("✅ Instancias de contratos inicializadas.");
} catch (error) {
  console.error("💥 ¡ERROR al inicializar los contratos!", error);
  process.exit(1);
}

// Create shared TransactionQueue with mutex for manual nonce management
const txQueue = new TransactionQueue(signer, getProvider(), {
  maxRetries: 5,
  retryDelay: 1500,
});
console.log("✅ TransactionQueue inicializada con mutex.");

let certificationVerifiedRouter;
let userRouter;
try {
  certificationVerifiedRouter = createCertificationVerifiedRouter(certificationVerifiedContract, txQueue, getTransactionDetails);
  userRouter = createUserRouter(usersContract, txQueue);
  console.log("✅ Rutas creados correctamente.");
} catch (error) {
  console.error("💥 ¡ERROR al crear las rutas!", error);
  process.exit(1);
}

try {
  app.use("/certificationVerified", certificationVerifiedRouter);
  console.log("🛣️  Router de certificación montado en /certificationVerified");
  app.use("/userVerified", userRouter);
  console.log("🛣️  Router de usuarios montado en /userVerified");
  app.use("/login", loginRouter);
  console.log("🛣️  Router de login montado en /login");
  app.use("/drissa", drissaRouter);
  console.log("🛣️  Router de drissa montado en /drissa");
  app.use("/node", nodeStatus);
  console.log("🛣️  Router de nodeStatus montado en /node");
} catch (error) {
  console.error("💥 ¡ERROR al montar los routers!", error);
  process.exit(1);
}

app.use((req, res, next) => {
  console.log(`🚫 404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Recurso no encontrado" });
});
app.use((err, req, res, next) => {
  console.error("💥 Error no manejado:", err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`🚀 API en ${PORT} usando dirección: ${signer.address}`);
});

server.on("error", (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof PORT === "string" ? "Pipe " + PORT : "Puerto " + PORT;
  switch (error.code) {
    case "EACCES":
      console.error(`❌ ${bind} requiere privilegios elevados.`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`❌ ${bind} ya está en uso.`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

process.on("SIGTERM", () => {
  console.log(" SIGTERM recibido. Cerrando servidor HTTP...");
  server.close(() => {
    console.log("Servidor HTTP cerrado.");
    process.exit(0);
  });
});
