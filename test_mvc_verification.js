const assert = require('assert');
const { parseFeatureContent } = require('./src/services/featureParser');
const { parseAllurePayloads, correlateAllureWithRun } = require('./src/services/allureParser');

console.log('🧪 Iniciando verificación de arquitectura MVC y Parsers...\n');

// --- 1. VERIFICACIÓN FEATURE PARSER ---
console.log('1. Probando FeatureParser...');

const sampleGherkinEs = `
# language: es
@regression @modulo:originacion
Característica: Solicitud de Datos Generales
  Como usuario del sistema de originación
  Quiero cargar los datos generales de una empresa
  Para dar inicio a la evaluación crediticia

  Antecedentes:
    Dado que el usuario inicia sesión con "operador@molinos.com"
    Y accede al menú de originación

  @smoke @alta @TC-001
  Escenario: Carga exitosa de datos generales válidos
    Dado que se encuentra en la pantalla de carga
    Cuando completa el CUIT "30123456789"
    Y selecciona el tipo societario "S.A."
    Y presiona "Guardar y Continuar"
    Entonces el sistema muestra el mensaje "Datos guardados correctamente"
    Y el estado pasa a "Pendiente de Validación"

  @TC-002 @media
  Esquema del escenario: Validación de campos requeridos
    Dado que se encuentra en la pantalla de carga
    Cuando omite el campo "<campo>"
    Y presiona "Guardar y Continuar"
    Entonces visualiza el error "<mensaje>"

    Ejemplos:
      | campo       | mensaje                      |
      | CUIT        | El CUIT es requerido         |
      | RazonSocial | La Razón Social es requerida |
`;

const parsedEs = parseFeatureContent(sampleGherkinEs, { filename: 'solicitud.feature' });
console.log(`   - Feature Name: "${parsedEs.groupName}"`);
console.log(`   - Casos extraídos: ${parsedEs.cases.length}`);
assert.strictEqual(parsedEs.groupName, 'Solicitud de Datos Generales');
assert.strictEqual(parsedEs.cases.length, 3, 'Debe extraer 1 escenario simple + 2 del esquema con ejemplos');
assert.strictEqual(parsedEs.cases[0].case_number, 'TC-001');
assert.strictEqual(parsedEs.cases[0].priority, 'Alta');
assert.ok(parsedEs.cases[0].gherkin_steps.includes('Antecedentes'), 'Debe incluir antecedentes');
assert.ok(parsedEs.cases[1].title.includes('CUIT'), 'Debe expandir el primer ejemplo con CUIT');
assert.ok(parsedEs.cases[2].title.includes('RazonSocial'), 'Debe expandir el segundo ejemplo con RazonSocial');
console.log('   ✅ FeatureParser pasó todas las aserciones.\n');

// --- 2. VERIFICACIÓN ALLURE PARSER ---
console.log('2. Probando AllureParser...');

const sampleAllureResult1 = {
  uuid: 'uuid-test-1',
  name: 'Carga exitosa de datos generales válidos',
  status: 'passed',
  start: 1700000000000,
  stop: 1700000002500,
  labels: [
    { name: 'tag', value: 'TC-001' },
    { name: 'feature', value: 'Solicitud de Datos Generales' }
  ],
  steps: [
    { name: 'Dado que se encuentra en la pantalla', status: 'passed' },
    { name: 'Cuando completa el CUIT', status: 'passed' },
    { name: 'Entonces el sistema muestra mensaje', status: 'passed' }
  ]
};

const sampleAllureResult2 = {
  uuid: 'uuid-test-2',
  name: 'Validación de campos requeridos [Ejemplo 1: campo="CUIT", mensaje="El CUIT es requerido"]',
  status: 'failed',
  start: 1700000003000,
  stop: 1700000005000,
  statusDetails: {
    message: 'Error: timed out 5000ms waiting for locator("text=El CUIT es requerido")',
    trace: 'Error at BasePage.validateError (base.page.ts:42)'
  },
  labels: [
    { name: 'tag', value: 'TC-002' }
  ]
};

const allureResults = parseAllurePayloads([
  { filename: 'result1-result.json', content: JSON.stringify(sampleAllureResult1) },
  { filename: 'result2-result.json', content: JSON.stringify(sampleAllureResult2) }
]);

assert.strictEqual(allureResults.length, 2);
assert.strictEqual(allureResults[0].status, 'Pass');
assert.strictEqual(allureResults[1].status, 'Fail');
assert.ok(allureResults[1].notes.includes('timed out 5000ms'), 'Debe incluir detalles del fallo en las notas');

// Correlacionar con casos de ejecución simulados
const mockExecutionCases = [
  { result_id: 101, case_id: 1, case_number: 'TC-001', title: 'Carga exitosa de datos generales válidos' },
  { result_id: 102, case_id: 2, case_number: 'TC-002', title: 'Validación de campos requeridos [Ejemplo 1: campo="CUIT", mensaje="El CUIT es requerido"]' },
  { result_id: 103, case_id: 3, case_number: 'TC-003', title: 'Otro caso no ejecutado' }
];

const correlation = correlateAllureWithRun(mockExecutionCases, allureResults);
console.log(`   - Coincidencias encontradas: ${correlation.matches.length}`);
console.log(`   - Casos Allure no coincidentes: ${correlation.unmatchedAllure.length}`);
console.log(`   - Casos Run sin resultado Allure: ${correlation.unmatchedRun.length}`);

assert.strictEqual(correlation.matches.length, 2);
assert.strictEqual(correlation.matches[0].allureResult.status, 'Pass');
assert.strictEqual(correlation.matches[1].allureResult.status, 'Fail');
assert.strictEqual(correlation.unmatchedRun.length, 1);
assert.strictEqual(correlation.unmatchedRun[0].result_id, 103);
console.log('   ✅ AllureParser pasó todas las aserciones.\n');

// --- 3. VERIFICACIÓN DE CARGA DE CONTROLADORES Y SERVER ---
console.log('3. Verificando carga del servidor Express y rutas...');
const app = require('./server');
assert.ok(app, 'El módulo server.js debe exportar la app express');
console.log('   ✅ Servidor Express modularizado cargó correctamente.');

console.log('\n🎉 TODAS LAS VERIFICACIONES COMPLETADAS CON ÉXITO.');
