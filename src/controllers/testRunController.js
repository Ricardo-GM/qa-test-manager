const TestRun = require('../models/TestRun');
const TestExecution = require('../models/TestExecution');
const Bug = require('../models/Bug');
const { generateTestRunPDF } = require('../services/pdfGenerator');
const { parseAllurePayloads, correlateAllureWithRun } = require('../services/allureParser');

class TestRunController {
  static getRuns(req, res) {
    try {
      const runs = TestRun.getAll();
      res.json(runs);
    } catch (error) {
      console.error('Error obteniendo ejecuciones:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getRunById(req, res) {
    try {
      const { id } = req.params;
      const run = TestRun.getById(id);
      if (!run) {
        return res.status(404).json({ error: 'Ejecución no encontrada.' });
      }

      const results = TestExecution.getByRunId(id);
      const allBugs = Bug.getAll();
      const runBugs = allBugs.filter(b => Number(b.run_id) === Number(id) && !b.case_id);

      res.json({ run, results, runBugs });
    } catch (error) {
      console.error('Error obteniendo detalle de ejecución:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static createRun(req, res) {
    try {
      const { name, environment, group_id } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'El nombre de la ejecución es obligatorio.' });
      }

      const runId = TestRun.create({
        name,
        environment,
        groupId: group_id
      });

      res.json({ success: true, runId, message: 'Ejecución de pruebas creada exitosamente.' });
    } catch (error) {
      console.error('Error creando Test Run:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static updateRun(req, res) {
    try {
      const { id } = req.params;
      const { name, environment } = req.body;
      TestRun.update(id, { name, environment });
      res.json({ success: true, message: 'Ejecución de pruebas actualizada correctamente.' });
    } catch (error) {
      console.error('Error actualizando Test Run:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteRun(req, res) {
    try {
      const { id } = req.params;
      TestRun.delete(id);
      res.json({ success: true, message: 'Ejecución eliminada exitosamente.' });
    } catch (error) {
      console.error('Error eliminando Test Run:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static exportPdf(req, res) {
    try {
      const { id } = req.params;
      const run = TestRun.getById(id);
      if (!run) return res.status(404).send('Ejecución no encontrada.');

      const cases = TestExecution.getByRunId(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_Pruebas_${run.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      generateTestRunPDF(run, cases, res);
    } catch (error) {
      console.error('Error generando PDF:', error);
      res.status(500).send('Error generando el PDF.');
    }
  }

  static importAllureResults(req, res) {
    try {
      const { id } = req.params;
      const run = TestRun.getById(id);
      if (!run) {
        return res.status(404).json({ error: 'Ejecución no encontrada.' });
      }

      // Preparar archivos subidos o payload JSON en el body
      const filesToProcess = [];

      if (req.files && req.files.length > 0) {
        req.files.forEach(f => {
          filesToProcess.push({
            filename: f.originalname,
            content: f.buffer
          });
        });
      } else if (req.file) {
        filesToProcess.push({
          filename: req.file.originalname,
          content: req.file.buffer
        });
      } else if (req.body && req.body.allureData) {
        filesToProcess.push({
          filename: 'payload.json',
          content: req.body.allureData
        });
      }

      if (filesToProcess.length === 0) {
        return res.status(400).json({ error: 'No se enviaron archivos o datos de Allure para procesar.' });
      }

      // Parsear los resultados de Allure
      const allureResults = parseAllurePayloads(filesToProcess);
      if (allureResults.length === 0) {
        return res.status(400).json({ error: 'No se encontraron resultados válidos en los archivos Allure provistos.' });
      }

      // Obtener casos de la corrida actual
      const executionCases = TestExecution.getByRunId(id);
      if (executionCases.length === 0) {
        return res.status(400).json({ error: 'La ejecución actual no tiene casos asociados para actualizar.' });
      }

      // Correlacionar
      const correlation = correlateAllureWithRun(executionCases, allureResults);

      // Actualizar cada caso emparejado
      let updatedCount = 0;
      for (const match of correlation.matches) {
        const resultId = match.runCase.result_id;
        TestExecution.update(resultId, {
          status: match.allureResult.status,
          notes: match.allureResult.notes,
          stepData: match.allureResult.stepData
        });
        updatedCount++;
      }

      res.json({
        success: true,
        updatedCount,
        totalAllureFound: allureResults.length,
        unmatchedAllureCount: correlation.unmatchedAllure.length,
        unmatchedRunCount: correlation.unmatchedRun.length,
        unmatchedAllureNames: correlation.unmatchedAllure.map(a => a.rawName),
        message: `Se actualizaron ${updatedCount} de ${executionCases.length} casos con los resultados del reporte Allure.`
      });
    } catch (error) {
      console.error('Error importando resultados Allure:', error);
      res.status(500).json({ error: 'Error procesando reporte Allure: ' + error.message });
    }
  }
}

module.exports = TestRunController;
