// app.js
require('dotenv').config(); // Carga variables de entorno
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Middlewares
app.use(express.json()); // Soporte para JSON
app.use(express.urlencoded({ extended: true })); // Soporte para URL-encoded
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`); // Log de cada request
    next();
});

// Rutas
const routesDir = path.join(__dirname, 'routes');
fs.readdirSync(routesDir).forEach((file) => {
    const routePath = `/${path.basename(file, '.js')}`; // Usa el nombre del archivo como ruta
    const route = require(path.join(routesDir, file)); // Importa la ruta
    app.use(routePath, route);
    console.log(`Ruta cargada: ${routePath}`);
    route.stack.forEach((layer) => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods)
                .map((method) => method.toUpperCase())
                .join(', ');
            console.log(`  [${methods}] ${routePath}${layer.route.path}`);
        }
    });
});

// Manejador de rutas no encontradas
app.use((req, res, next) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores generales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal' });
});

module.exports = app;
