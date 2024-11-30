// server.js
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Crea y levanta el servidor
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`API corriendo en el puerto ${PORT}`);
    app._router.stack.forEach((middleware) => {
        if (middleware.route) { // Solo mostrar rutas definidas
            console.log(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
        }
    });
});

// Manejador de errores del servidor
server.on('error', (error) => {
    console.error('Error en el servidor:', error.message);
});
