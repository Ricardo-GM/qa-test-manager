/**
 * Parser de archivos .feature (Gherkin/Cucumber)
 * Soporta sintaxis bilingüe (Español e Inglés), Background, Tags,
 * Escenarios y expansión de Esquemas de Escenario (Scenario Outlines) con tablas de Ejemplos.
 */

function cleanLine(line) {
  return line ? line.trim() : '';
}

/**
 * Extrae tags de una o varias líneas consecutivas que empiezan con @
 */
function extractTags(lines) {
  const tags = [];
  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('@')) {
      const parts = trimmed.split(/\s+/).filter(p => p.startsWith('@'));
      tags.push(...parts);
    }
  });
  return tags;
}

/**
 * Determina prioridad basada en tags
 */
function getPriorityFromTags(tags) {
  const lower = tags.map(t => t.toLowerCase());
  if (lower.some(t => t.includes('alta') || t.includes('high') || t.includes('critica') || t.includes('critical') || t.includes('p1') || t.includes('blocker'))) {
    return 'Alta';
  }
  if (lower.some(t => t.includes('baja') || t.includes('low') || t.includes('minor') || t.includes('p3') || t.includes('trivial'))) {
    return 'Baja';
  }
  return 'Media';
}

/**
 * Busca un identificador de caso en tags o título (ej. @TC-001, @TC01, @CASO-12, [TC-01])
 */
function extractCaseNumber(tags, title, defaultIndex) {
  for (const tag of tags) {
    const m = tag.match(/^@(TC[-_]?\d+|CP[-_]?\d+|CASO[-_]?\d+|HU\d+[-_]TC\d+)/i);
    if (m) {
      return m[1].toUpperCase().replace('_', '-');
    }
  }

  const titleMatch = title.match(/^\[?(TC[-_]?\d+|CP[-_]?\d+|CASO[-_]?\d+)\]?[:\s-]/i);
  if (titleMatch) {
    return titleMatch[1].toUpperCase().replace('_', '-');
  }

  return `TC-${String(defaultIndex).padStart(3, '0')}`;
}

/**
 * Parsea el contenido de un archivo .feature
 * @param {string} fileContent - Texto plano del archivo .feature
 * @param {object} options - Opciones adicionales (ej: filename)
 * @returns {object} { groupName, summary, tags, cases: [...] }
 */
function parseFeatureContent(fileContent, options = {}) {
  const lines = fileContent.split(/\r?\n/);
  
  let groupName = options.filename ? options.filename.replace(/\.feature$/i, '') : 'Característica BDD';
  let featureSummary = '';
  let featureTags = [];
  
  let backgroundSteps = [];
  const rawSections = [];
  
  let currentTags = [];
  let currentSection = null; // { type: 'feature'|'background'|'scenario'|'outline', title: '', tags: [], lines: [] }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Ignorar comentarios puros (#) a menos que indiquen lenguaje
    if (line.startsWith('#')) {
      continue;
    }

    // Líneas de tags
    if (line.startsWith('@')) {
      const tagsInLine = line.split(/\s+/).filter(t => t.startsWith('@'));
      currentTags.push(...tagsInLine);
      continue;
    }

    // Header Feature / Característica
    const featureMatch = line.match(/^(?:Feature|Característica|Caracteristica)\s*:\s*(.*)$/i);
    if (featureMatch) {
      groupName = featureMatch[1].trim() || groupName;
      featureTags = [...currentTags];
      currentTags = [];
      currentSection = { type: 'feature', lines: [] };
      continue;
    }

    // Header Background / Antecedentes
    const backgroundMatch = line.match(/^(?:Background|Antecedentes)\s*:\s*(.*)$/i);
    if (backgroundMatch) {
      if (currentSection && currentSection.type !== 'feature') {
        rawSections.push(currentSection);
      }
      currentSection = { type: 'background', lines: [] };
      currentTags = [];
      continue;
    }

    // Header Scenario / Escenario
    const scenarioMatch = line.match(/^(?:Scenario|Escenario)\s*:\s*(.*)$/i);
    if (scenarioMatch) {
      if (currentSection) {
        rawSections.push(currentSection);
      }
      currentSection = {
        type: 'scenario',
        title: scenarioMatch[1].trim(),
        tags: [...currentTags],
        lines: []
      };
      currentTags = [];
      continue;
    }

    // Header Scenario Outline / Esquema del escenario
    const outlineMatch = line.match(/^(?:Scenario\s+Outline|Esquema\s+del\s+escenario|Plantilla\s+del\s+escenario)\s*:\s*(.*)$/i);
    if (outlineMatch) {
      if (currentSection) {
        rawSections.push(currentSection);
      }
      currentSection = {
        type: 'outline',
        title: outlineMatch[1].trim(),
        tags: [...currentTags],
        lines: []
      };
      currentTags = [];
      continue;
    }

    // Contenido dentro de la sección actual
    if (currentSection) {
      currentSection.lines.push(rawLine);
    } else if (line) {
      // Líneas antes de feature si las hubiera
    }
  }

  if (currentSection) {
    rawSections.push(currentSection);
  }

  // Procesar feature summary y background
  rawSections.forEach(sec => {
    if (sec.type === 'feature') {
      featureSummary = sec.lines.map(l => l.trim()).filter(Boolean).join(' ');
    } else if (sec.type === 'background') {
      backgroundSteps = sec.lines.map(l => l.trim()).filter(l => isGherkinStep(l));
    }
  });

  // Procesar escenarios y esquemas
  const parsedCases = [];
  let caseCounter = 1;

  for (const sec of rawSections) {
    if (sec.type === 'scenario') {
      const scenarioTags = Array.from(new Set([...featureTags, ...sec.tags]));
      const priority = getPriorityFromTags(scenarioTags);
      const caseNumber = extractCaseNumber(sec.tags, sec.title, caseCounter++);
      
      const steps = [];
      const descLines = [];

      sec.lines.forEach(l => {
        const trimmed = l.trim();
        if (!trimmed) return;
        if (isGherkinStep(trimmed)) {
          steps.push(trimmed);
        } else if (trimmed.startsWith('|')) {
          // Tablas de datos adjuntas a un paso
          steps.push('    ' + trimmed);
        } else {
          descLines.push(trimmed);
        }
      });

      const formattedSteps = buildFormattedSteps(backgroundSteps, steps);
      const summary = descLines.length > 0 
        ? descLines.join(' ') 
        : (scenarioTags.length > 0 ? `Tags: ${scenarioTags.join(' ')}` : '');

      parsedCases.push({
        case_number: caseNumber,
        title: sec.title || `Escenario ${caseCounter - 1}`,
        summary: summary,
        gherkin_steps: formattedSteps,
        priority: priority,
        tags: scenarioTags
      });

    } else if (sec.type === 'outline') {
      // Parsear tabla de ejemplos
      const outlineTags = Array.from(new Set([...featureTags, ...sec.tags]));
      const priority = getPriorityFromTags(outlineTags);
      
      const templateSteps = [];
      const exampleRows = [];
      let inExamples = false;
      let exampleHeaders = [];

      for (const rawL of sec.lines) {
        const trimmed = rawL.trim();
        if (!trimmed) continue;

        if (trimmed.match(/^(?:Examples|Ejemplos)\s*:/i)) {
          inExamples = true;
          continue;
        }

        if (inExamples) {
          if (trimmed.startsWith('|')) {
            const cells = trimmed.split('|').map(c => c.trim()).slice(1, -1);
            if (exampleHeaders.length === 0) {
              exampleHeaders = cells;
            } else {
              exampleRows.push(cells);
            }
          }
        } else {
          if (isGherkinStep(trimmed)) {
            templateSteps.push(trimmed);
          } else if (trimmed.startsWith('|')) {
            templateSteps.push('    ' + trimmed);
          }
        }
      }

      // Si tiene ejemplos con filas, expandir cada fila en un caso concreto
      if (exampleHeaders.length > 0 && exampleRows.length > 0) {
        exampleRows.forEach((row, rowIndex) => {
          const caseNumber = extractCaseNumber(sec.tags, `${sec.title} - Ejemplo ${rowIndex + 1}`, caseCounter++);
          const rowMap = {};
          exampleHeaders.forEach((h, idx) => {
            rowMap[h] = row[idx] !== undefined ? row[idx] : '';
          });

          // Reemplazar <variable> en los pasos
          const concreteSteps = templateSteps.map(step => {
            let replaced = step;
            exampleHeaders.forEach(h => {
              const regex = new RegExp(`<${h}>`, 'g');
              replaced = replaced.replace(regex, rowMap[h]);
            });
            return replaced;
          });

          const formattedSteps = buildFormattedSteps(backgroundSteps, concreteSteps);
          const exampleValuesSummary = Object.entries(rowMap).map(([k, v]) => `${k}="${v}"`).join(', ');

          parsedCases.push({
            case_number: caseNumber,
            title: `${sec.title} [Ejemplo ${rowIndex + 1}: ${exampleValuesSummary}]`,
            summary: `Esquema expandido. Parámetros: ${exampleValuesSummary}. ${outlineTags.length > 0 ? 'Tags: ' + outlineTags.join(' ') : ''}`.trim(),
            gherkin_steps: formattedSteps,
            priority: priority,
            tags: outlineTags
          });
        });
      } else {
        // Guardar como plantilla de escenario única
        const caseNumber = extractCaseNumber(sec.tags, sec.title, caseCounter++);
        const formattedSteps = buildFormattedSteps(backgroundSteps, templateSteps);
        
        parsedCases.push({
          case_number: caseNumber,
          title: sec.title || `Esquema de Escenario ${caseCounter - 1}`,
          summary: outlineTags.length > 0 ? `Tags: ${outlineTags.join(' ')}` : '',
          gherkin_steps: formattedSteps,
          priority: priority,
          tags: outlineTags
        });
      }
    }
  }

  return {
    groupName,
    summary: featureSummary,
    tags: featureTags,
    cases: parsedCases
  };
}

function isGherkinStep(line) {
  return /^(?:Given|When|Then|And|But|Dado|Dada|Dados|Dadas|Cuando|Entonces|Y|Pero|\*)\s+/i.test(line);
}

function buildFormattedSteps(backgroundSteps, scenarioSteps) {
  const parts = [];
  if (backgroundSteps && backgroundSteps.length > 0) {
    parts.push('# --- Antecedentes (Background) ---');
    parts.push(...backgroundSteps);
    parts.push('# --- Escenario ---');
  }
  parts.push(...scenarioSteps);
  return parts.join('\n');
}

module.exports = {
  parseFeatureContent,
  isGherkinStep,
  getPriorityFromTags,
  extractCaseNumber
};
