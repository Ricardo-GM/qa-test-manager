const TestCase = require('../models/TestCase');
const TestGroup = require('../models/TestGroup');
const { parseExcelTestCases } = require('../services/excelParser');
const { parseFeatureContent } = require('../services/featureParser');

class TestCaseController {
  static getTestCases(req, res) {
    try {
      const groupId = req.query.group_id;
      const cases = TestCase.getAll(groupId);
      res.json(cases);
    } catch (error) {
      console.error('Error obteniendo casos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static importExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo Excel.' });
      }

      const cases = parseExcelTestCases(req.file.buffer);

      if (cases.length === 0) {
        return res.status(400).json({ error: 'No se encontraron casos de prueba válidos en el archivo Excel.' });
      }

      const customGroupName = req.body.group_name && req.body.group_name.trim()
        ? req.body.group_name.trim()
        : req.file.originalname.replace(/\.[^/.]+$/, '');

      const newGroup = TestGroup.create(customGroupName);
      const insertedCount = TestCase.createMany(newGroup.id, cases);

      res.json({
        success: true,
        groupId: newGroup.id,
        groupName: customGroupName,
        message: `Se creó el grupo "${customGroupName}" con ${insertedCount} casos de prueba correctamente.`
      });
    } catch (error) {
      console.error('Error importando Excel:', error);
      res.status(500).json({ error: 'Error interno procesando el archivo Excel.' });
    }
  }

  static importFeature(req, res) {
    try {
      const files = req.files || (req.file ? [req.file] : []);
      const directText = req.body.feature_text;

      if (files.length === 0 && (!directText || !directText.trim())) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo .feature ni se ha enviado contenido Gherkin.' });
      }

      const createdGroups = [];
      let totalCasesImported = 0;

      if (directText && directText.trim()) {
        const parsed = parseFeatureContent(directText, { filename: req.body.group_name || 'Característica Directa' });
        if (parsed.cases.length === 0) {
          return res.status(400).json({ error: 'No se encontraron escenarios de prueba válidos en el texto Gherkin provisto.' });
        }
        const groupName = req.body.group_name && req.body.group_name.trim() ? req.body.group_name.trim() : parsed.groupName;
        const newGroup = TestGroup.create(groupName);
        const count = TestCase.createMany(newGroup.id, parsed.cases);
        totalCasesImported += count;
        createdGroups.push({ groupId: newGroup.id, groupName, count });
      } else {
        for (const file of files) {
          const content = file.buffer.toString('utf-8');
          const parsed = parseFeatureContent(content, { filename: file.originalname });

          if (parsed.cases.length === 0) {
            continue;
          }

          const groupName = req.body.group_name && files.length === 1 && req.body.group_name.trim()
            ? req.body.group_name.trim()
            : parsed.groupName;

          const newGroup = TestGroup.create(groupName);
          const count = TestCase.createMany(newGroup.id, parsed.cases);
          totalCasesImported += count;
          createdGroups.push({ groupId: newGroup.id, groupName, count });
        }
      }

      if (totalCasesImported === 0) {
        return res.status(400).json({ error: 'No se encontraron escenarios válidos en los archivos .feature procesados.' });
      }

      res.json({
        success: true,
        totalCases: totalCasesImported,
        groups: createdGroups,
        message: `Se importaron exitosamente ${totalCasesImported} casos de prueba en ${createdGroups.length} grupo(s).`
      });
    } catch (error) {
      console.error('Error importando archivo(s) .feature:', error);
      res.status(500).json({ error: 'Error interno procesando archivo(s) .feature: ' + error.message });
    }
  }
}

module.exports = TestCaseController;
