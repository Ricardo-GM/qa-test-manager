const path = require('path');
const fs = require('fs');
const TestExecution = require('../models/TestExecution');

class ExecutionController {
  static updateExecution(req, res) {
    try {
      const { resultId } = req.params;
      const { status, notes, evidence_paths, step_data } = req.body;

      const updated = TestExecution.update(resultId, {
        status,
        notes,
        evidencePaths: evidence_paths,
        stepData: step_data
      });

      if (!updated) {
        return res.status(404).json({ error: 'Resultado de prueba no encontrado.' });
      }

      res.json({ success: true, message: 'Estado de prueba actualizado.' });
    } catch (error) {
      console.error('Error actualizando ejecución:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static uploadGenericEvidence(req, res, uploadsDir) {
    try {
      let addedPath = '';

      if (req.file) {
        addedPath = `uploads/${req.file.filename}`;
      } else if (req.body && req.body.base64Image) {
        const match = req.body.base64Image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const filename = `paste-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const fullPath = path.join(uploadsDir, filename);
          fs.writeFileSync(fullPath, buffer);
          addedPath = `uploads/${filename}`;
        } else {
          return res.status(400).json({ error: 'Formato de imagen en base64 no válido.' });
        }
      } else {
        return res.status(400).json({ error: 'No se envió ningún archivo.' });
      }

      res.json({ success: true, evidence_path: addedPath });
    } catch (error) {
      console.error('Error subiendo evidencia genérica:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static addEvidence(req, res, uploadsDir) {
    try {
      const { resultId } = req.params;
      const existing = TestExecution.getById(resultId);
      if (!existing) return res.status(404).json({ error: 'Resultado de prueba no encontrado.' });

      let addedPath = '';

      if (req.file) {
        addedPath = `uploads/${req.file.filename}`;
      } else if (req.body && req.body.base64Image) {
        const match = req.body.base64Image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const filename = `paste-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const fullPath = path.join(uploadsDir, filename);
          fs.writeFileSync(fullPath, buffer);
          addedPath = `uploads/${filename}`;
        } else {
          return res.status(400).json({ error: 'Formato de imagen en base64 no válido.' });
        }
      } else {
        return res.status(400).json({ error: 'No se envió ningún archivo de imagen ni contenido en base64.' });
      }

      const updatedEvidencePaths = TestExecution.addEvidence(resultId, addedPath);

      res.json({
        success: true,
        message: 'Evidencia agregada exitosamente.',
        evidence_paths: updatedEvidencePaths
      });
    } catch (error) {
      console.error('Error guardando evidencia:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteEvidence(req, res, baseDir) {
    try {
      const { resultId } = req.params;
      const { evidencePath } = req.body;

      const updatedEvidencePaths = TestExecution.removeEvidence(resultId, evidencePath, baseDir);
      if (!updatedEvidencePaths) {
        return res.status(404).json({ error: 'Resultado de prueba no encontrado.' });
      }

      res.json({
        success: true,
        message: 'Evidencia eliminada.',
        evidence_paths: updatedEvidencePaths
      });
    } catch (error) {
      console.error('Error eliminando evidencia:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ExecutionController;
