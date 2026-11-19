const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./server');

const PORT = 3099;

const server = app.listen(PORT, async () => {
  console.log(`🧪 Servidor de prueba e2e iniciado en puerto ${PORT}`);

  try {
    // Helper para fetch local
    const baseUrl = `http://localhost:${PORT}`;

    // 1. Verificar GET /api/test-groups
    console.log('1. Probando GET /api/test-groups...');
    let res = await fetch(`${baseUrl}/api/test-groups`);
    let groups = await res.json();
    console.log(`   Grupos existentes: ${groups.length}`);

    // 2. Importar sample_casos_prueba.feature
    console.log('2. Probando POST /api/test-cases/import-feature...');
    const featureContent = fs.readFileSync(path.join(__dirname, 'sample_casos_prueba.feature'), 'utf-8');
    
    // Test import con multipart FormData simulado o payload directo
    const blob = new Blob([featureContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('featureFiles', blob, 'solicitud_datos_generales.feature');

    res = await fetch(`${baseUrl}/api/test-cases/import-feature`, {
      method: 'POST',
      body: formData
    });

    const importRes = await res.json();
    console.log('   Resultado importación .feature:', importRes);
    if (!importRes.success) throw new Error('Fallo importación .feature: ' + JSON.stringify(importRes));

    const newGroupId = importRes.groups[0].groupId;
    console.log(`   ✅ Grupo creado ID: ${newGroupId} (${importRes.groups[0].groupName}) con ${importRes.groups[0].count} casos.`);

    // 3. Crear una nueva Jornada de Pruebas (Test Run) para este grupo
    console.log('3. Probando POST /api/test-runs...');
    res = await fetch(`${baseUrl}/api/test-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regresión Sprint 1 - Originación BDD',
        environment: 'QA',
        group_id: newGroupId
      })
    });
    const runRes = await res.json();
    console.log('   Resultado creación Test Run:', runRes);
    if (!runRes.success) throw new Error('Fallo creación Test Run');
    const newRunId = runRes.runId;

    // 4. Ingestar resultados Allure (tc001-result.json y tc002-result.json)
    console.log('4. Probando POST /api/test-runs/:id/import-allure...');
    const allure1 = fs.readFileSync(path.join(__dirname, 'sample_allure_results', 'tc001-result.json'));
    const allure2 = fs.readFileSync(path.join(__dirname, 'sample_allure_results', 'tc002-result.json'));

    const allureFormData = new FormData();
    allureFormData.append('allureFiles', new Blob([allure1], { type: 'application/json' }), 'tc001-result.json');
    allureFormData.append('allureFiles', new Blob([allure2], { type: 'application/json' }), 'tc002-result.json');

    res = await fetch(`${baseUrl}/api/test-runs/${newRunId}/import-allure`, {
      method: 'POST',
      body: allureFormData
    });
    const allureImportRes = await res.json();
    console.log('   Resultado ingesta Allure:', allureImportRes);
    if (!allureImportRes.success) throw new Error('Fallo ingesta Allure');

    // 5. Verificar que el Test Run tenga los casos actualizados
    console.log('5. Verificando estado de los casos en Test Run...');
    res = await fetch(`${baseUrl}/api/test-runs/${newRunId}`);
    const runDetail = await res.json();

    const case1 = runDetail.results.find(r => r.case_number === 'TC-001' || r.title.includes('Carga exitosa'));
    const case2 = runDetail.results.find(r => r.case_number === 'TC-002' || r.title.includes('inválido'));

    console.log(`   - Caso 1 (${case1.case_number}): Estado = ${case1.status} (Esperado: Pass)`);
    console.log(`   - Caso 2 (${case2.case_number}): Estado = ${case2.status} (Esperado: Fail)`);
    console.log(`   - Notas del fallo Caso 2: ${case2.notes.substring(0, 80)}...`);

    if (case1.status !== 'Pass') throw new Error(`Caso 1 debió ser Pass pero fue ${case1.status}`);
    if (case2.status !== 'Fail') throw new Error(`Caso 2 debió ser Fail pero fue ${case2.status}`);

    // Limpieza de datos de prueba creados
    await fetch(`${baseUrl}/api/test-runs/${newRunId}`, { method: 'DELETE' });
    await fetch(`${baseUrl}/api/test-groups/${newGroupId}`, { method: 'DELETE' });

    console.log('\n🎉 VALIDACIÓN INTEGRAL DE FLUJO COMPLETADA CON 100% DE ÉXITO.');

  } catch (error) {
    console.error('❌ Error en test e2e:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
