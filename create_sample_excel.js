const xlsx = require('xlsx');
const path = require('path');

const sampleData = [
  {
    "Número de caso de prueba": "TC001",
    "Titulo": "Iniciar sesión con credenciales válidas",
    "Resumen": "Validar que el usuario pueda ingresar a la plataforma con usuario y clave correctos.",
    "Cucumber": "Given que el usuario navega a la página de login\nWhen ingresa usuario 'admin@test.com' y clave 'Pass123!'\nAnd hace clic en el botón 'Iniciar Sesión'\nThen debería ver el Dashboard principal con mensaje de bienvenida.",
    "Prioridad": "Alta"
  },
  {
    "Número de caso de prueba": "TC002",
    "Titulo": "Validar mensaje de error en login con credenciales inválidas",
    "Resumen": "Comprobar que se despliegue una alerta roja al ingresar datos erróneos.",
    "Cucumber": "Given que el usuario navega a la página de login\nWhen ingresa usuario 'invalid@test.com' y clave 'WrongPass'\nAnd hace clic en el botón 'Iniciar Sesión'\nThen debería mostrarse el mensaje 'Credenciales incorrectas'.",
    "Prioridad": "Media"
  },
  {
    "Número de caso de prueba": "TC003",
    "Titulo": "Registro de nuevo usuario completo",
    "Resumen": "Creación exitosa de una cuenta nueva completando el formulario.",
    "Cucumber": "Given que el usuario entra al formulario de registro\nWhen completa nombre 'Juan', correo 'juan@test.com' y teléfono '5551234'\nAnd presiona 'Crear cuenta'\nThen el sistema envía un correo de confirmación y redirige a la pantalla de éxito.",
    "Prioridad": "Alta"
  },
  {
    "Número de caso de prueba": "TC004",
    "Titulo": "Descarga de reporte de transacciones en PDF",
    "Resumen": "Verificar la descarga correcta del reporte financiero.",
    "Cucumber": "Given que el usuario está autenticado en la sección de Reportes\nWhen selecciona el filtro 'Último mes'\nAnd hace clic en 'Exportar PDF'\nThen el navegador inicia la descarga del archivo 'Reporte_Mensual.pdf'.",
    "Prioridad": "Baja"
  }
];

const worksheet = xlsx.utils.json_to_sheet(sampleData);
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, worksheet, 'CasosDePrueba');

const outputPath = path.join(__dirname, 'sample_casos_prueba.xlsx');
xlsx.writeFile(workbook, outputPath);

console.log(`Ejemplo de Excel creado exitosamente en: ${outputPath}`);
