const fs = require('fs');
const path = require('path');
const { parseFeatureContent } = require('../src/services/featureParser');
const { mapAllureStatus, normalizeString } = require('../src/services/allureParser');

const FEATURES_BASE = 'F:\\Baufest\\Molinos Agro\\Fase 2\\fw-auto-molinos-agro\\tests\\features';
const ALLURE_RESULTS_DIR = 'F:\\Baufest\\Molinos Agro\\Fase 2\\fw-auto-molinos-agro\\allure-results';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DB_PATH = path.join(__dirname, '..', 'database.json');

const HU_CONFIGS = [
  { hu: 'HU13', folder: 'HU13', file: 'solicitud_datos_generales.feature', name: 'HU13 - Originación: Solicitud y datos generales', runName: 'HU13_C1 - Originación: Solicitud y datos generales' },
  { hu: 'HU14', folder: 'HU14', file: 'informacion_productiva.feature', name: 'HU14 - Originación: Información productiva, operativa y documentación', runName: 'HU14_C1 - Originación: Información productiva' },
  { hu: 'HU15', folder: 'HU15', file: 'mercado_local_solicitud.feature', name: 'HU15 - Mercado Local: Gestión de clientes y solicitudes de Subproducto', runName: 'HU15_C1 - Mercado Local: Solicitud Subproducto' },
  { hu: 'HU16', folder: 'HU16', file: 'migracion_clientes_historico.feature', name: 'HU16 - Mercado Local: Migración de clientes e información histórica', runName: 'HU16_C1 - Mercado Local: Migración histórica' },
  { hu: 'HU17', folder: 'HU17', file: 'solicitudes_creadas_gestion.feature', name: 'HU17 - Solicitudes creadas: Consulta, seguimiento y gestión del flujo', runName: 'HU17_C1 - Solicitudes creadas y gestión' },
  { hu: 'HU18', folder: 'HU18', file: 'abm_roles_permisos.feature', name: 'HU18 - Administración de usuarios, roles y permisos: ABM Roles y Permisos', runName: 'HU18_C1 - ABM Roles y Permisos' },
  { hu: 'HU19', folder: 'HU19', file: 'reportes_metricas_solicitudes.feature', name: 'HU19 - Reportes y métricas de solicitudes de crédito', runName: 'HU19_C1 - Reportes y métricas' },
  { hu: 'HU20', folder: 'HU20', file: 'abm_variables_ponderaciones_score.feature', name: 'HU20 - ABM Variables y ponderaciones Score', runName: 'HU20_C1 - ABM Variables y Score' }
];

function loadAllureResults() {
  console.log(`[1/5] Leyendo archivos de resultados de Allure en: ${ALLURE_RESULTS_DIR}...`);
  const files = fs.readdirSync(ALLURE_RESULTS_DIR).filter(f => f.endsWith('-result.json'));
  console.log(`      Total de archivos result.json encontrados: ${files.length}`);

  const resultsByHu = {};

  files.forEach(f => {
    try {
      const fullPath = path.join(ALLURE_RESULTS_DIR, f);
      const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const labels = json.labels || [];
      const huTag = labels.find(l => l.name === 'tag' && /^HU\d+$/i.test(l.value));
      if (!huTag) return;
      const hu = huTag.value.toUpperCase();
      if (!resultsByHu[hu]) resultsByHu[hu] = [];

      const cpTag = labels.find(l => l.name === 'tag' && /^CP[-_]?\d+/i.test(l.value));
      let cp = cpTag ? cpTag.value.toUpperCase().replace('_', '-') : null;
      if (!cp) {
        const m = json.name.match(/(CP[-_]?\d+)/i);
        if (m) cp = m[1].toUpperCase().replace('_', '-');
      }

      // Extraer imágenes png
      const pngSources = [];
      const addPng = (att) => {
        if (att && att.source && (att.type === 'image/png' || att.source.endsWith('.png'))) {
          if (!pngSources.includes(att.source)) pngSources.push(att.source);
        }
      };
      (json.attachments || []).forEach(addPng);
      const scanSteps = (steps) => {
        if (!steps) return;
        steps.forEach(s => {
          (s.attachments || []).forEach(addPng);
          if (s.steps) scanSteps(s.steps);
        });
      };
      scanSteps(json.steps);

      // Duración y tiempos
      const durationMs = (json.stop && json.start) ? (json.stop - json.start) : 0;
      const durationSec = durationMs > 0 ? (durationMs / 1000).toFixed(2) + 's' : '';

      // Estado mapeado
      const status = mapAllureStatus(json.status);

      // Notas detalladas
      let notes = '';
      if (json.statusDetails && (json.statusDetails.message || json.statusDetails.trace)) {
        const errorMsg = json.statusDetails.message ? `Mensaje: ${json.statusDetails.message.trim()}` : '';
        const errorTrace = json.statusDetails.trace ? `\nTraza:\n${json.statusDetails.trace.trim()}` : '';
        notes = `[Allure Report - ${status}] ${errorMsg}${errorTrace}`.trim();
      } else if (durationSec) {
        notes = `[Allure Report - ${status}] Duración: ${durationSec}`;
      }

      // Detalle de pasos
      const stepData = {};
      if (Array.isArray(json.steps)) {
        json.steps.forEach((s, idx) => {
          stepData[idx] = {
            name: s.name,
            status: mapAllureStatus(s.status),
            duration: (s.stop && s.start) ? (s.stop - s.start) : 0
          };
        });
      }

      // Índice de ejemplos en Scenario Outlines
      let exampleIndex = null;
      const exMatch = json.name.match(/Ejemplos?:\s*#(\d+)/i);
      if (exMatch) {
        exampleIndex = parseInt(exMatch[1], 10);
      }

      resultsByHu[hu].push({
        file: f,
        name: json.name,
        normalizedName: normalizeString(json.name),
        cp,
        exampleIndex,
        status,
        allureStatus: json.status,
        notes,
        stepData,
        pngSources,
        start: json.start || 0,
        stop: json.stop || Date.now()
      });
    } catch (e) {
      // Ignorar errores menores de parseo en JSON corruptos
    }
  });

  return resultsByHu;
}

function syncFase2(dryRun = false) {
  console.log('===============================================================');
  console.log(` Iniciando sincronización de Fase 2 (Dry Run: ${dryRun})`);
  console.log('===============================================================');

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const allureResultsByHu = loadAllureResults();

  // 1. Limpieza de pruebas previas o grupos incompletos de Fase 2 (ej: 21, 22, 23 y corridas 22, 23, 24)
  const obsoleteGroupIds = [21, 22, 23];
  const obsoleteRunIds = [22, 23, 24];
  // 1. Limpieza de pruebas previas o grupos de Fase 2 (HU13 a HU20)
  const isFase2Group = g => /^HU(1[3-9]|20)\b/i.test(g.name) || /Solicitud de Datos Generales/i.test(g.name);
  const obsoleteGroups = dbData.test_groups.filter(isFase2Group);
  const obsoleteGroupIds = obsoleteGroups.map(g => g.id);
  const obsoleteRuns = dbData.test_runs.filter(r => obsoleteGroupIds.includes(r.group_id));
  const obsoleteRunIds = obsoleteRuns.map(r => r.id);

  console.log(`[2/5] Limpiando borradores previos (Grupos: ${obsoleteGroupIds}, Runs: ${obsoleteRunIds})...`);
  console.log(`[2/5] Limpiando ejecuciones previas de Fase 2 (Grupos: [${obsoleteGroupIds.join(', ')}], Runs: [${obsoleteRunIds.join(', ')}])...`);
  dbData.test_groups = dbData.test_groups.filter(g => !obsoleteGroupIds.includes(g.id));
  dbData.test_cases = dbData.test_cases.filter(c => !obsoleteGroupIds.includes(c.group_id));
  dbData.test_runs = dbData.test_runs.filter(r => !obsoleteRunIds.includes(r.id));
  dbData.test_execution_results = dbData.test_execution_results.filter(r => !obsoleteRunIds.includes(r.run_id));

  let nextGroupId = Math.max(...dbData.test_groups.map(g => g.id), 0) + 1;
  let nextCaseId = Math.max(...dbData.test_cases.map(c => c.id), 0) + 1;
  let nextRunId = Math.max(...dbData.test_runs.map(r => r.id), 0) + 1;
  let nextResultId = Math.max(...dbData.test_execution_results.map(r => r.id), 0) + 1;

  let totalCasesCreated = 0;
  let totalImagesCopied = 0;
  let summaryReport = [];

  console.log('[3/5] Procesando cada Historia de Usuario (HU)...');

  HU_CONFIGS.forEach(cfg => {
    const featPath = path.join(FEATURES_BASE, cfg.folder, cfg.file);
    if (!fs.existsSync(featPath)) {
      console.warn(`[WARN] Archivo no encontrado: ${featPath}`);
      return;
    }

    const featContent = fs.readFileSync(featPath, 'utf-8');
    const parsed = parseFeatureContent(featContent, { filename: cfg.file });
    const huAllure = allureResultsByHu[cfg.hu] || [];

    // Crear Test Group (Test Plan)
    const groupId = nextGroupId++;
    const groupName = cfg.name;
    const createdAt = new Date().toISOString();

    dbData.test_groups.push({
      id: groupId,
      name: groupName,
      created_at: createdAt
    });

    // Crear Test Run (Test Execution)
    const runId = nextRunId++;
    dbData.test_runs.push({
      id: runId,
      name: cfg.runName,
      environment: 'QA',
      group_id: groupId,
      status: 'In Progress',
      created_at: createdAt
    });

    let huCasesCreated = 0;
    let huPassed = 0;
    let huFailed = 0;
    let huBlocked = 0;
    let huUntested = 0;
    let huImages = 0;

    parsed.cases.forEach(c => {
      const caseId = nextCaseId++;
      huCasesCreated++;
      totalCasesCreated++;

      // Guardar caso de prueba
      dbData.test_cases.push({
        id: caseId,
        group_id: groupId,
        case_number: c.case_number,
        title: c.title,
        summary: c.summary || '',
        gherkin_steps: c.gherkin_steps || '',
        priority: c.priority || 'Media',
        created_at: createdAt
      });

      // Emparejar con Allure Result
      const exM = c.title.match(/\[Ejemplo\s+(\d+):/i);
      const exIdx = exM ? parseInt(exM[1], 10) : null;

      let candidates = huAllure.filter(a => a.cp === c.case_number);
      // Ordenar por última ejecución (stop más reciente)
      candidates.sort((a, b) => b.stop - a.stop);
      let match = null;

      if (candidates.length === 1) {
        match = candidates[0];
      } else if (candidates.length > 1) {
      if (candidates.length > 0) {
        if (exIdx !== null) {
          match = candidates.find(a => a.exampleIndex === exIdx);
        }
        if (!match) {
          // Si no empareja por índice, ordenar por última ejecución
          candidates.sort((a, b) => b.stop - a.stop);
          match = candidates[0];
        }
      } else {
        const normCase = normalizeString(c.title);
        match = huAllure.find(a => a.normalizedName === normCase || a.normalizedName.includes(normCase) || normCase.includes(a.normalizedName));
        const nameMatches = huAllure.filter(a => a.normalizedName === normCase || a.normalizedName.includes(normCase) || normCase.includes(a.normalizedName));
        if (nameMatches.length > 0) {
          nameMatches.sort((a, b) => b.stop - a.stop);
          match = nameMatches[0];
        }
      }

      // Preparar resultado de ejecución
      const resultId = nextResultId++;
      let status = 'Untested';
      let notes = '';
      let stepData = {};
      let evidencePaths = [];
      let executedAt = null;

      if (match) {
        status = match.status;
        notes = match.notes;
        stepData = match.stepData;
        executedAt = new Date(match.stop).toISOString();

        if (status === 'Pass') huPassed++;
        else if (status === 'Fail') huFailed++;
        else if (status === 'Blocked') huBlocked++;
        else huUntested++;

        // Copiar evidencias de captura de pantalla
        if (Array.isArray(match.pngSources) && match.pngSources.length > 0) {
          match.pngSources.forEach(srcFile => {
            const srcFullPath = path.join(ALLURE_RESULTS_DIR, srcFile);
            if (fs.existsSync(srcFullPath)) {
              const cleanCp = c.case_number.toLowerCase().replace(/[^a-z0-9_-]/g, '');
              const destFileName = `evidence-${cfg.hu.toLowerCase()}-${cleanCp}-${srcFile}`;
              const destFullPath = path.join(UPLOADS_DIR, destFileName);

              if (!dryRun) {
                fs.copyFileSync(srcFullPath, destFullPath);
              }
              const relativePath = `uploads/${destFileName}`;
              if (!evidencePaths.includes(relativePath)) {
                evidencePaths.push(relativePath);
                huImages++;
                totalImagesCopied++;
              }
            }
          });
        }
      } else {
        huUntested++;
      }

      dbData.test_execution_results.push({
        id: resultId,
        run_id: runId,
        case_id: caseId,
        status,
        notes,
        step_data: stepData,
        evidence_path: evidencePaths.length > 0 ? evidencePaths[0] : null,
        evidence_paths: evidencePaths,
        executed_at: executedAt
      });
    });

    summaryReport.push({
      HU: cfg.hu,
      Plan: groupName,
      Run: cfg.runName,
      TotalCases: huCasesCreated,
      Pass: huPassed,
      Fail: huFailed,
      Blocked: huBlocked,
      Untested: huUntested,
      Images: huImages
    });
  });

  // Actualizar auto_ids
  dbData.auto_ids = {
    test_groups: nextGroupId,
    test_cases: nextCaseId,
    test_runs: nextRunId,
    test_execution_results: nextResultId,
    bugs: Math.max(...dbData.bugs.map(b => b.id), 0) + 1
  };

  if (!dryRun) {
    console.log('[4/5] Guardando cambios en database.json...');
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  }

  console.log('[5/5] Sincronización completada exitosamente.');
  console.log('---------------------------------------------------------------');
  console.table(summaryReport);
  console.log('---------------------------------------------------------------');
  console.log(`TOTALES: Casos creados: ${totalCasesCreated} | Imágenes de evidencia asociadas: ${totalImagesCopied}`);
  console.log('===============================================================');

  return summaryReport;
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  syncFase2(isDryRun);
}

module.exports = { syncFase2 };

