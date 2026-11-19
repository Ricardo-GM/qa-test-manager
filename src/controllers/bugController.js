const Bug = require('../models/Bug');
const { generateBugsPDF } = require('../services/pdfGenerator');

class BugController {
  static getBugs(req, res) {
    try {
      const bugs = Bug.getAll(req.query);
      res.json(bugs);
    } catch (error) {
      console.error('Error obteniendo bugs:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static createBug(req, res) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'El título del bug es obligatorio.' });
      }

      const bugId = Bug.create(req.body);
      res.json({ success: true, bugId, message: 'Bug registrado exitosamente.' });
    } catch (error) {
      console.error('Error creando Bug:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static updateBug(req, res) {
    try {
      const { id } = req.params;
      Bug.update(id, req.body);
      res.json({ success: true, message: 'Bug actualizado exitosamente.' });
    } catch (error) {
      console.error('Error actualizando Bug:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteBug(req, res) {
    try {
      const { id } = req.params;
      Bug.delete(id);
      res.json({ success: true, message: 'Bug eliminado exitosamente.' });
    } catch (error) {
      console.error('Error eliminando Bug:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteEvidence(req, res, baseDir) {
    try {
      const { bugId } = req.params;
      const { evidencePath } = req.body;

      const updatedEvidencePaths = Bug.removeEvidence(bugId, evidencePath, baseDir);
      if (!updatedEvidencePaths) {
        return res.status(404).json({ error: 'Bug no encontrado.' });
      }

      res.json({ success: true, message: 'Evidencia de bug eliminada.' });
    } catch (error) {
      console.error('Error eliminando evidencia de bug:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static exportPdf(req, res) {
    try {
      const bugs = Bug.getAll(req.query);
      const { assigned_to } = req.query;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_Bugs_${assigned_to ? assigned_to.replace(/[^a-zA-Z0-9]/g, '_') : 'General'}.pdf`);

      generateBugsPDF(bugs, req.query, res);
    } catch (error) {
      console.error('Error generando PDF de Bugs:', error);
      if (!res.headersSent) {
        res.status(500).send('Error generando el reporte PDF de Bugs.');
      }
    }
  }
}

module.exports = BugController;
