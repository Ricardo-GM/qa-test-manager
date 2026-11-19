# QA Test Manager 🧪

Herramienta local de gestión de pruebas QA con arquitectura **MVC**, importación de casos de prueba desde especificaciones **Gherkin BDD (.feature)** y **Excel (.xlsx)**, seguimiento de ejecuciones manuales/automatizadas e ingesta directa de resultados desde **Allure Report**.

---

## 🚀 Requisitos Previos

- **Node.js**: Versión 18+ instalada en tu sistema.
- **npm**: Administrador de paquetes (incluido con Node.js).

---

## 🛠️ Instalación y Configuración

1. **Clonar o abrir la carpeta del proyecto** en tu terminal.
2. **Instalar dependencias**:

```bash
npm install
```

---

## 🏃‍♂️ Cómo Ejecutar el Proyecto

### Modo Producción / Estándar
Inicia el servidor Node.js:

```bash
npm start
```

### Modo Desarrollo (Auto-recarga)
Ejecuta el servidor con monitoreo de cambios (`node --watch`):

```bash
npm run dev
```

Una vez iniciado el servidor, abre tu navegador e ingresa a:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧩 Nuevas Capacidades de Automatización & BDD

### 1. Importación de Casos desde Archivos `.feature` (Gherkin BDD)
- Admite archivos `.feature` en **Español** (`Característica`, `Escenario`, `Esquema del escenario`, `Dado`, `Cuando`, `Entonces`, etc.) e **Inglés** (`Feature`, `Scenario`, `Scenario Outline`, `Given`, `When`, etc.).
- Permite subir archivos individuales o múltiples, o **pegar texto Gherkin** directamente desde el portapapeles.
- Expande automáticamente los esquemas con tablas `Examples` / `Ejemplos` en casos de prueba concretos.
- Extrae tags como `@smoke`, `@alta`, `@media`, `@baja`, `@TC-001` para priorización y trazabilidad.

### 2. Ingesta de Resultados desde Allure Report
- Sincroniza automáticamente los resultados de frameworks E2E como **Playwright**, **Cucumber** o **Cypress**.
- Acepta archivos `*-result.json` de la carpeta `allure-results/` o el archivo agregado `suites.json` de `allure-report/data/`.
- Mapea estados: `passed` $\rightarrow$ **Pass**, `failed` $\rightarrow$ **Fail**, `broken` $\rightarrow$ **Blocked**, `skipped` $\rightarrow$ **Desestimado**.
- En casos fallidos, adjunta automáticamente el mensaje de error y la traza de ejecución a las notas del caso.

---

## 📁 Estructura del Proyecto (Patrón MVC)

```text
qa-test-manager/
├── src/
│   ├── config/                # Configuraciones auxiliares (Multer, storage)
│   ├── models/                # [Model] Abstracción y persistencia (TestGroup, TestCase, TestRun, TestExecution, Bug)
│   ├── controllers/           # [Controller] Lógica de orquestación HTTP y endpoints
│   ├── routes/                # Definición modular de rutas (/api/test-groups, /api/test-cases, /api/test-runs, etc.)
│   └── services/              # Lógica de dominio y parsers (featureParser, allureParser, excelParser, pdfGenerator)
├── public/                    # [View] Interfaz gráfica SPA (HTML5, CSS3, Vanilla JS)
├── uploads/                   # Carpeta de almacenamiento de evidencias multimedia
├── server.js                  # Entrypoint principal de Express (< 30 líneas)
├── database.js                # Adaptador de persistencia JSON zero-dependency
├── database.json              # Base de datos local
├── sample_casos_prueba.feature# Archivo .feature BDD de ejemplo
├── sample_allure_results/     # Resultados de ejemplo de Allure (*-result.json)
└── package.json
```

---

## 🧪 Pruebas de Verificación

Para ejecutar la suite de pruebas unitarias y de integración del flujo MVC:

```bash
npm test
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**.
