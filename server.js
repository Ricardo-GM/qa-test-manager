const express = require('express');
const path = require('path');
const { uploadsDir } = require('./src/config/multer');
const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Rutas API bajo prefijo /api
app.use('/api', apiRoutes);

// Iniciar servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` 🚀 Local QA Manager activo (MVC Architecture)`);
    console.log(` 🌐 Servidor disponible en http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
