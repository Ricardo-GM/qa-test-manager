/**
 * Parser de resultados de Allure Report
 * Soporta archivos directos *-result.json (Allure 2) y archivos agregados (suites.json, behaviors.json).
 */

/**
 * Normaliza estados de Allure a los estados estándar de QA Test Manager
 * @param {string} allureStatus - 'passed', 'failed', 'broken', 'skipped', 'unknown'
 * @returns {string} 'Pass' | 'Fail' | 'Blocked' | 'Desestimado' | 'Untested'
 */
function mapAllureStatus(allureStatus) {
  if (!allureStatus) return 'Untested';
  const lower = String(allureStatus).toLowerCase().trim();
  switch (lower) {
    case 'passed':
      return 'Pass';
    case 'failed':
      return 'Fail';
    case 'broken':
      return 'Blocked';
    case 'skipped':
    case 'unknown':
      return 'Desestimado';
    default:
      return 'Untested';
  }
}

/**
 * Normaliza cadenas de texto para comparar títulos de forma insensible a mayúsculas, espacios y caracteres especiales
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[\[\]"':_#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae información de un resultado individual de Allure (*-result.json)
 * @param {object} json - Contenido JSON parseado
 * @returns {object} Caso normalizado con estado, notas, pasos y metadatos
 */
function parseAllureResultFile(json) {
  if (!json || typeof json !== 'object') return null;

  // Extraer nombre del test / escenario
  const name = json.name || json.fullName || 'Prueba sin nombre';
  const status = mapAllureStatus(json.status);
  
  // Extraer etiquetas (labels)
  const labels = Array.isArray(json.labels) ? json.labels : [];
  const tags = labels.map(l => l.value);
  const featureLabel = labels.find(l => l.name === 'feature' || l.name === 'suite');
  const featureName = featureLabel ? featureLabel.value : '';

  // Extraer identificador de caso si existe en etiquetas o nombre (ej: @TC-001)
  let caseId = null;
  for (const tag of tags) {
    const m = String(tag).match(/(TC[-_]?\d+|CP[-_]?\d+|CASO[-_]?\d+)/i);
    if (m) {
      caseId = m[1].toUpperCase().replace('_', '-');
      break;
    }
  }

  // Tiempos
  const durationMs = (json.stop && json.start) ? (json.stop - json.start) : 0;
  const durationSec = durationMs > 0 ? (durationMs / 1000).toFixed(2) + 's' : '';

  // Notas de error / detalle
  let notes = '';
  if (json.statusDetails && (json.statusDetails.message || json.statusDetails.trace)) {
    const errorMsg = json.statusDetails.message ? `Mensaje: ${json.statusDetails.message.trim()}` : '';
    const errorTrace = json.statusDetails.trace ? `\nTraza:\n${json.statusDetails.trace.trim()}` : '';
    notes = `[Allure Report - ${status}] ${errorMsg}${errorTrace}`.trim();
  } else if (durationSec) {
    notes = `[Allure Report - ${status}] Duración: ${durationSec}`;
  }

  // Pasos individuales
  const stepData = {};
  if (Array.isArray(json.steps)) {
    json.steps.forEach((s, idx) => {
      stepData[idx] = {
        status: mapAllureStatus(s.status),
        name: s.name,
        duration: (s.stop && s.start) ? (s.stop - s.start) : 0
      };
    });
  }

  return {
    rawName: name,
    normalizedName: normalizeString(name),
    featureName,
    caseId,
    status,
    allureStatus: json.status,
    notes,
    stepData,
    durationMs,
    tags
  };
}

/**
 * Parsea un archivo agregado suites.json o behaviors.json recursivamente
 */
function parseAllureSuiteRecursive(node, results = [], currentFeature = '') {
  if (!node) return results;

  const feature = node.name || currentFeature;

  if (Array.isArray(node.children)) {
    node.children.forEach(child => parseAllureSuiteRecursive(child, results, feature));
  } else if (node.name && node.status) {
    // Es una hoja de prueba ejecutada
    results.push({
      rawName: node.name,
      normalizedName: normalizeString(node.name),
      featureName: currentFeature,
      caseId: null,
      status: mapAllureStatus(node.status),
      allureStatus: node.status,
      notes: `[Allure Report - ${mapAllureStatus(node.status)}] Duración: ${node.time && node.time.duration ? (node.time.duration / 1000).toFixed(2) + 's' : 'N/A'}`,
      stepData: {},
      durationMs: node.time ? node.time.duration : 0,
      tags: []
    });
  }

  return results;
}

/**
 * Parsea un conjunto de archivos JSON de Allure subidos
 * @param {Array<{ filename: string, content: string|Buffer|object }>} files
 * @returns {Array<object>} Lista de resultados procesados
 */
function parseAllurePayloads(files) {
  const parsedResults = [];

  for (const f of files) {
    let json = null;
    try {
      if (typeof f.content === 'object' && !Buffer.isBuffer(f.content)) {
        json = f.content;
      } else {
        const raw = Buffer.isBuffer(f.content) ? f.content.toString('utf-8') : String(f.content);
        json = JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[AllureParser] Archivo no es JSON válido: ${f.filename || 'unknown'}`);
      continue;
    }

    if (!json) continue;

    // Verificar si es suites.json o behaviors.json
    if (json.children && Array.isArray(json.children)) {
      const suiteResults = parseAllureSuiteRecursive(json);
      parsedResults.push(...suiteResults);
    } else if (json.name || json.status) {
      // Es un archivo individual *-result.json
      const result = parseAllureResultFile(json);
      if (result) {
        parsedResults.push(result);
      }
    }
  }

  return parsedResults;
}

/**
 * Empareja los resultados de Allure con los casos de una ejecución activa
 * @param {Array<object>} executionCases - Lista de casos en la ejecución con { result_id, case_id, case_number, title }
 * @param {Array<object>} allureResults - Lista de resultados de Allure procesados
 * @returns {object} { matches: [...], unmatchedAllure: [...], unmatchedRun: [...] }
 */
function correlateAllureWithRun(executionCases, allureResults) {
  const matches = [];
  const matchedRunCaseIds = new Set();
  const matchedAllureIndices = new Set();

  // 1. Intento por coincidencia de case_number (ej. TC-001)
  allureResults.forEach((allure, aIdx) => {
    if (allure.caseId) {
      const match = executionCases.find(rc => {
        if (matchedRunCaseIds.has(rc.result_id)) return false;
        const normalizedRunNum = (rc.case_number || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normalizedAllureNum = allure.caseId.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalizedRunNum && normalizedAllureNum && (normalizedRunNum === normalizedAllureNum || normalizedRunNum.includes(normalizedAllureNum) || normalizedAllureNum.includes(normalizedRunNum));
      });

      if (match) {
        matches.push({
          runCase: match,
          allureResult: allure,
          matchType: 'case_number'
        });
        matchedRunCaseIds.add(match.result_id);
        matchedAllureIndices.add(aIdx);
      }
    }
  });

  // 2. Intento por coincidencia exacta o fuerte de título
  allureResults.forEach((allure, aIdx) => {
    if (matchedAllureIndices.has(aIdx)) return;

    const normAllure = allure.normalizedName;
    if (!normAllure) return;

    const match = executionCases.find(rc => {
      if (matchedRunCaseIds.has(rc.result_id)) return false;
      const normRunTitle = normalizeString(rc.title);
      return normRunTitle === normAllure;
    });

    if (match) {
      matches.push({
        runCase: match,
        allureResult: allure,
        matchType: 'exact_title'
      });
      matchedRunCaseIds.add(match.result_id);
      matchedAllureIndices.add(aIdx);
    }
  });

  // 3. Intento por inclusión de subcadena (fuzzy)
  allureResults.forEach((allure, aIdx) => {
    if (matchedAllureIndices.has(aIdx)) return;

    const normAllure = allure.normalizedName;
    if (!normAllure || normAllure.length < 5) return;

    const match = executionCases.find(rc => {
      if (matchedRunCaseIds.has(rc.result_id)) return false;
      const normRunTitle = normalizeString(rc.title);
      return normRunTitle && (normRunTitle.includes(normAllure) || normAllure.includes(normRunTitle));
    });

    if (match) {
      matches.push({
        runCase: match,
        allureResult: allure,
        matchType: 'fuzzy_title'
      });
      matchedRunCaseIds.add(match.result_id);
      matchedAllureIndices.add(aIdx);
    }
  });

  const unmatchedAllure = allureResults.filter((_, idx) => !matchedAllureIndices.has(idx));
  const unmatchedRun = executionCases.filter(rc => !matchedRunCaseIds.has(rc.result_id));

  return {
    matches,
    unmatchedAllure,
    unmatchedRun
  };
}

module.exports = {
  mapAllureStatus,
  normalizeString,
  parseAllureResultFile,
  parseAllurePayloads,
  correlateAllureWithRun
};
