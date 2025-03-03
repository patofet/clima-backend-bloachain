// app.js
require("dotenv").config(); // Carga variables de entorno
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

// Middlewares
app.use(express.json()); // Soporte para JSON
app.use(express.urlencoded({ extended: true })); // Soporte para URL-encoded
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`); // Log de cada request
  // save the request to a log file
  if (req.path.includes("/certification/")) {
    const body = JSON.stringify(req.body);
    const url = JSON.stringify(req.query);
    fs.appendFile(
      "log.txt",
      `${new Date().getTime()}:${req.method}:${req.path}:${body}:${url}\n`,
      (err) => {
        if (err) {
          console.error("Error al guardar el log:", err);
        }
      }
    );
  }
  next();
});

// Rutas
const routesDir = path.join(__dirname, "routes");
console.log("Rutas disponibles:");
fs.readdirSync(routesDir).forEach((file) => {
  const routePath = `/${path.basename(file, ".js")}`; // Usa el nombre del archivo como ruta
  const route = require(path.join(routesDir, file)); // Importa la ruta
  app.use(routePath, route);
  console.log(` -${routePath}`);
  route.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((method) => method.toUpperCase())
        .join(", ");
      console.log(`   ·[${methods}] ${routePath}${layer.route.path}`);
    }
  });
});

// Manejador de rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejador de errores generales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Algo salió mal" });
});
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
module.exports = app;
