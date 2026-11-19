const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Genera un PDF de la jornada de prueba activa y lo transmite al res (Express response).
 * @param {Object} runData Información de la ejecución (test_runs)
 * @param {Array} casesList Lista de resultados (join test_execution_results & test_cases)
 * @param {WritableStream} outputStream Stream de salida (res)
 */
function generateTestRunPDF(runData, casesList, outputStream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  doc.pipe(outputStream);

  // Paleta de colores Dark Glassmorphism para el PDF
  const COLOR_PRIMARY = '#1e1b4b'; // Deep Navy
  const COLOR_ACCENT = '#6366f1';  // Indigo
  const COLOR_TEXT = '#0f172a';    // Dark Slate
  const COLOR_PASS = '#059669';    // Emerald
  const COLOR_FAIL = '#e11d48';    // Rose
  const COLOR_BLOCKED = '#d97706'; // Amber
  const COLOR_UNTESTED = '#64748b';// Gray
  const COLOR_DESESTIMADO = '#6d28d9'; // Violet for Dismissed

  // --- ENCABEZADO ---
  doc.rect(0, 0, 595.28, 80).fill(COLOR_PRIMARY);
  
  doc.fillColor('#ffffff')
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('LOCAL QA - REPORTE DE EJECUCIÓN', 40, 25);

  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#cbd5e1')
     .text(`Entorno: ${runData.environment || 'QA'} | Generado: ${new Date().toLocaleString()}`, 40, 52);

  doc.y = 100;

  // --- DASHBOARD DE MÉTRICAS ---
  const total = casesList.length;
  const passed = casesList.filter(c => c.status === 'Pass').length;
  const failed = casesList.filter(c => c.status === 'Fail').length;
  const blocked = casesList.filter(c => c.status === 'Blocked').length;
  const desestimado = casesList.filter(c => c.status === 'Desestimado').length;
  const untested = total - (passed + failed + blocked + desestimado);

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Tarjeta de Resumen
  doc.rect(40, 95, 515, 65).fillAndStroke('#f8fafc', '#e2e8f0');

  doc.fillColor(COLOR_TEXT)
     .fontSize(12)
     .font('Helvetica-Bold')
     .text(`Ejecución: ${runData.name}`, 55, 105);

  doc.fontSize(10).font('Helvetica');
  doc.fillColor(COLOR_PASS).text(`Pasados: ${passed}`, 55, 125);
  doc.fillColor(COLOR_FAIL).text(`Fallados: ${failed}`, 130, 125);
  doc.fillColor(COLOR_BLOCKED).text(`Bloqueados: ${blocked}`, 205, 125);
  doc.fillColor(COLOR_DESESTIMADO).text(`Desestimados: ${desestimado}`, 290, 125);
  doc.fillColor(COLOR_UNTESTED).text(`Sin probar: ${untested}`, 385, 125);
  doc.fillColor(COLOR_ACCENT).font('Helvetica-Bold').text(`Éxito: ${passRate}%`, 480, 125);

  doc.y = 180;

  // --- LISTADO DE CASOS DE PRUEBA ---
  doc.fillColor(COLOR_PRIMARY)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Detalle de Casos Ejecutados', 40, doc.y);

  doc.moveDown(0.5);

  const sortedCases = [...casesList].sort((a, b) => {
    const valA = String(a.case_number || '');
    const valB = String(b.case_number || '');
    const numA = parseInt(valA.replace(/\D/g, ''), 10);
    const numB = parseInt(valB.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
  });

  sortedCases.forEach((item, index) => {
    // Comprobar si necesitamos una nueva página
    if (doc.y > 680) {
      doc.addPage();
      doc.y = 40;
    }

    const startY = doc.y;

    // Determinar color por estado
    let statusColor = COLOR_UNTESTED;
    if (item.status === 'Pass') statusColor = COLOR_PASS;
    if (item.status === 'Fail') statusColor = COLOR_FAIL;
    if (item.status === 'Blocked') statusColor = COLOR_BLOCKED;
    if (item.status === 'Desestimado') statusColor = COLOR_DESESTIMADO;

    // Caja contenedora del caso
    doc.rect(40, startY, 515, 20).fill('#f1f5f9');
    
    // Encabezado del caso
    doc.fillColor(COLOR_PRIMARY)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`[${item.case_number}] ${item.title}`, 45, startY + 5, { width: 340, height: 15 });

    doc.fillColor('#475569')
       .fontSize(9)
       .font('Helvetica')
       .text(`Prioridad: ${item.priority || 'Media'}`, 390, startY + 5);

    // Badge de Estado
    doc.rect(475, startY + 3, 75, 14).fill(statusColor);
    doc.fillColor('#ffffff')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text((item.status || 'Untested').toUpperCase(), 475, startY + 6, { width: 75, align: 'center' });

    doc.y = startY + 28;

    // Resumen
    if (item.summary) {
      doc.fillColor(COLOR_TEXT).font('Helvetica-Oblique').fontSize(9).text(`Resumen: ${item.summary}`, 45, doc.y, { width: 505 });
      doc.moveDown(0.3);
    }

    // Pasos desglosados (Solo lectura)
    const rawSteps = String(item.gherkin_steps || item.summary || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (rawSteps.length > 0) {
      doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(9).text('PASOS DEL CASO DE PRUEBA:', 45, doc.y);
      doc.moveDown(0.2);

      rawSteps.forEach((stepText, idx) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 40;
        }

        const stepY = doc.y;
        doc.fillColor('#1e293b').font('Courier-Bold').fontSize(8.5).text(`Paso ${idx + 1}: `, 50, stepY, { continued: true });
        doc.fillColor('#334155').font('Courier').fontSize(8.5).text(stepText);
        doc.y += 10;
      });
      doc.y += 6;
    }

    // Notas generales de observación
    if (item.notes) {
      if (doc.y > 700) { doc.addPage(); doc.y = 40; }
      doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(9).text('Notas Generales del Caso:', 45, doc.y);
      doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(9).text(item.notes, 45, doc.y + 12, { width: 505 });
      doc.y += 28;
    }

    // Galería de evidencias del caso de prueba
    const evidenceList = Array.isArray(item.evidence_paths)
      ? item.evidence_paths
      : (item.evidence_path ? [item.evidence_path] : []);

    if (evidenceList.length > 0) {
      if (doc.y > 550) {
        doc.addPage();
        doc.y = 40;
      }
      doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(9).text(`Evidencias del Caso (${evidenceList.length}):`, 45, doc.y);
      doc.moveDown(0.3);

      evidenceList.forEach((evPath, evIdx) => {
        const fullPath = path.join(__dirname, '..', evPath);
        if (fs.existsSync(fullPath)) {
          if (doc.y > 550) {
            doc.addPage();
            doc.y = 40;
          }
          try {
            doc.fillColor('#475569').font('Helvetica').fontSize(8).text(`Captura ${evIdx + 1}:`, 45, doc.y);
            doc.moveDown(0.2);
            doc.image(fullPath, 45, doc.y, { fit: [350, 180], align: 'left' });
            doc.y += 190;
          } catch (err) {
            console.error('Error al insertar imagen en PDF:', err);
          }
        }
      });
    }

    // Separador entre casos
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).stroke();
    doc.y += 12;
  });

  doc.end();
}

/**
 * Genera un reporte PDF con la lista de Bugs filtrados por persona asignada, estado, etc.
 * @param {Array} bugsList Lista de objetos Bug
 * @param {Object} filterOptions Filtros aplicados
 * @param {WritableStream} outputStream Stream Express res
 */
function generateBugsPDF(bugsList, filterOptions, outputStream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  doc.pipe(outputStream);

  const COLOR_PRIMARY = '#1e1b4b';
  const COLOR_TEXT = '#0f172a';
  const COLOR_FAIL = '#e11d48';
  const COLOR_WARNING = '#d97706';
  const COLOR_PASS = '#059669';

  // --- ENCABEZADO ---
  doc.rect(0, 0, 595.28, 80).fill('#991b1b'); // Dark Red for Bugs
  
  doc.fillColor('#ffffff')
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('LOCAL QA - REPORTE DE BUGS & DEFECTOS', 40, 22);

  const filterParts = [];
  if (filterOptions.assigned_to && filterOptions.assigned_to !== 'ALL') filterParts.push(`Asignado: ${filterOptions.assigned_to}`);
  if (filterOptions.status && filterOptions.status !== 'ALL') filterParts.push(`Estado: ${filterOptions.status}`);
  if (filterOptions.severity && filterOptions.severity !== 'ALL') filterParts.push(`Severidad: ${filterOptions.severity}`);
  if (filterOptions.group_id && filterOptions.group_id !== 'ALL') {
    const firstMatch = bugsList.find(b => String(b.group_id) === String(filterOptions.group_id));
    filterParts.push(`HU/Grupo: ${firstMatch ? firstMatch.group_name : filterOptions.group_id}`);
  }
  if (filterOptions.run_id && filterOptions.run_id !== 'ALL') {
    const firstMatch = bugsList.find(b => String(b.run_id) === String(filterOptions.run_id));
    filterParts.push(`Ejecución: ${firstMatch ? firstMatch.run_name : filterOptions.run_id}`);
  }

  const filterText = filterParts.length > 0 ? filterParts.join(' | ') : 'Filtros: Todos los registros';

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#fca5a5')
     .text(`${filterText}`, 40, 48, { width: 515, height: 12 })
     .text(`Generado: ${new Date().toLocaleString()}`, 40, 60);

  doc.y = 100;

  // --- MÉTRICAS DE BUGS ---
  const total = bugsList.length;
  const abiertos = bugsList.filter(b => b.status === 'Abierto').length;
  const enProgreso = bugsList.filter(b => b.status === 'En Progreso').length;
  const resueltos = bugsList.filter(b => b.status === 'Resuelto' || b.status === 'Cerrado').length;

  doc.rect(40, 95, 515, 55).fillAndStroke('#fff1f2', '#fecdd3');

  doc.fillColor(COLOR_TEXT)
     .fontSize(12)
     .font('Helvetica-Bold')
     .text(`Total Bugs Registrados: ${total}`, 55, 105);

  doc.fontSize(10).font('Helvetica');
  doc.fillColor(COLOR_FAIL).text(`Abiertos: ${abiertos}`, 55, 125);
  doc.fillColor(COLOR_WARNING).text(`En Progreso: ${enProgreso}`, 185, 125);
  doc.fillColor(COLOR_PASS).text(`Resueltos / Cerrados: ${resueltos}`, 325, 125);

  doc.y = 170;

  // --- LISTADO DE BUGS ---
  doc.fillColor(COLOR_PRIMARY)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Detalle de Bugs', 40, doc.y);

  doc.moveDown(0.5);

  if (bugsList.length === 0) {
    doc.fillColor('#64748b').fontSize(11).font('Helvetica-Oblique').text('No se encontraron bugs registrados con los filtros seleccionados.', 40, doc.y);
  } else {
    bugsList.forEach((bug) => {
      if (doc.y > 660) {
        doc.addPage();
        doc.y = 40;
      }

      const startY = doc.y;

      let sevColor = '#64748b';
      if (bug.severity === 'Alta') sevColor = COLOR_FAIL;
      if (bug.severity === 'Media') sevColor = COLOR_WARNING;
      if (bug.severity === 'Baja') sevColor = '#2563eb';

      // Header card bug
      doc.rect(40, startY, 515, 22).fill('#f8fafc');

      doc.fillColor(COLOR_PRIMARY)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`#${bug.id} - ${bug.title}`, 45, startY + 6, { width: 330, height: 14 });

      doc.fillColor(sevColor)
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text(`Prioridad: ${bug.severity || 'Media'}`, 380, startY + 6);

      doc.fillColor(COLOR_TEXT)
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text(bug.status || 'Abierto', 475, startY + 6, { width: 75, align: 'right' });

      doc.y = startY + 28;

      const caseStr = bug.case_number ? (bug.case_title ? `${bug.case_number} - ${bug.case_title}` : bug.case_number) : 'General de la Ejecución';
      const huStr = bug.group_name || 'Sin Historia de Usuario';
      const runStr = bug.run_name || 'Sin Ejecución';

      doc.fillColor('#334155').font('Helvetica').fontSize(8.5)
         .text(`Asignado a: `, 45, doc.y, { continued: true })
         .font('Helvetica-Bold').text(`${bug.assigned_to || 'Sin Asignar'}`, { continued: true })
         .font('Helvetica').text(`  |  HU/Grupo: `, { continued: true })
         .font('Helvetica-Bold').text(`${huStr}`, { continued: true })
         .font('Helvetica').text(`  |  Ejecución: `, { continued: true })
         .font('Helvetica-Bold').text(`${runStr}`)
         .font('Helvetica').text(`Caso: ${caseStr}`, 45, doc.y + 11);

      doc.y += 24;

      // 1. Descripción
      if (bug.description) {
        if (doc.y > 700) { doc.addPage(); doc.y = 40; }
        doc.fillColor(COLOR_PRIMARY).font('Helvetica-Bold').fontSize(8.5).text('Descripción:', 45, doc.y);
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(bug.description, 55, doc.y + 10, { width: 495 });
        doc.y += 14 + (doc.heightOfString(bug.description, { width: 495 }));
      }

      // 2. Pasos de Reproducción
      if (bug.reproduction) {
        if (doc.y > 700) { doc.addPage(); doc.y = 40; }
        doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8.5).text('Pasos de Reproducción:', 45, doc.y);
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(bug.reproduction, 55, doc.y + 10, { width: 495 });
        doc.y += 14 + (doc.heightOfString(bug.reproduction, { width: 495 }));
      }

      // 3. Resultado Esperado
      if (bug.expected_result) {
        if (doc.y > 700) { doc.addPage(); doc.y = 40; }
        doc.fillColor(COLOR_PASS).font('Helvetica-Bold').fontSize(8.5).text('Resultado Esperado:', 45, doc.y);
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(bug.expected_result, 55, doc.y + 10, { width: 495 });
        doc.y += 14 + (doc.heightOfString(bug.expected_result, { width: 495 }));
      }

      // Evidencias
      if (bug.evidence_paths && bug.evidence_paths.length > 0) {
        if (doc.y > 580) { doc.addPage(); doc.y = 40; }
        doc.fillColor('#1e1b4b').font('Helvetica-Bold').fontSize(8.5)
           .text(`Evidencias Asociadas (${bug.evidence_paths.length}):`, 45, doc.y);
        doc.y += 12;

        bug.evidence_paths.forEach((evPath, evIdx) => {
          const fullPath = path.join(__dirname, '..', evPath);
          if (fs.existsSync(fullPath)) {
            if (doc.y > 600) {
              doc.addPage();
              doc.y = 40;
            }
            try {
              doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`Captura ${evIdx + 1}:`, 45, doc.y);
              doc.y += 10;
              doc.image(fullPath, 45, doc.y, { fit: [280, 140], align: 'left' });
              doc.y += 150;
            } catch (err) {
              console.error('Error al insertar evidencia de bug en PDF:', err);
            }
          }
        });
      }

      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
      doc.y += 12;
    });
  }

  doc.end();
}

module.exports = { generateTestRunPDF, generateBugsPDF };
