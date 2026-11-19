const xlsx = require('xlsx');

function cleanGherkinSteps(text) {
  if (!text) return '';
  return String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Parsea un buffer de archivo Excel (.xlsx) y extrae los casos de prueba.
 * @param {Buffer} fileBuffer
 * @returns {Array} Lista de casos de prueba formateados
 */
function parseExcelTestCases(fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir hoja a JSON con encabezados de primera fila
  const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

  const parsedCases = [];

  rawData.forEach((row, index) => {
    // Normalizar claves buscando coincidencia flexible de nombres de columnas
    let caseNumber = '';
    let title = '';
    let summary = '';
    let gherkinSteps = '';
    let priority = 'Media';

    Object.keys(row).forEach((key) => {
      const normalizedKey = key.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos

      const val = String(row[key]).trim();

      if (normalizedKey.includes('numero') || normalizedKey.includes('nro') || normalizedKey.includes('caso')) {
        caseNumber = val;
      } else if (normalizedKey.includes('titulo')) {
        title = val;
      } else if (normalizedKey.includes('resumen')) {
        summary = val;
      } else if (normalizedKey.includes('cucumber') || normalizedKey.includes('gherkin') || normalizedKey.includes('paso')) {
        gherkinSteps = val;
      } else if (normalizedKey.includes('prioridad')) {
        if (['alta', 'high'].includes(val.toLowerCase())) priority = 'Alta';
        else if (['baja', 'low'].includes(val.toLowerCase())) priority = 'Baja';
        else priority = 'Media';
      }
    });

    // Si no vino número de caso explícito, asignar uno correlativo
    if (!caseNumber) {
      caseNumber = `TC-${String(index + 1).padStart(3, '0')}`;
    }

    const cleanedGherkin = cleanGherkinSteps(gherkinSteps);

    if (title || summary || cleanedGherkin) {
      parsedCases.push({
        case_number: caseNumber,
        title: title || `Caso sin título ${index + 1}`,
        summary: summary || '',
        gherkin_steps: cleanedGherkin,
        priority: priority
      });
    }
  });

  return parsedCases;
}

module.exports = { parseExcelTestCases };
