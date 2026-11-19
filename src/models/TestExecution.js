const db = require('../../database');
const fs = require('fs');
const path = require('path');

class TestExecution {
  static getByRunId(runId) {
    return db.prepare('SELECT * FROM test_execution_results WHERE run_id = ?').all(runId);
  }

  static getById(id) {
    return db.prepare('SELECT * FROM test_execution_results WHERE id = ?').get(id);
  }

  static update(id, { status, notes, evidencePaths, stepData }) {
    const existing = this.getById(id);
    if (!existing) return null;

    const currentEvidences = evidencePaths !== undefined 
      ? evidencePaths 
      : (existing.evidence_paths || (existing.evidence_path ? [existing.evidence_path] : []));

    const currentStepData = stepData !== undefined 
      ? stepData 
      : (existing.step_data || {});

    db.prepare(`
      UPDATE test_execution_results
      SET status = ?, notes = ?, evidence_paths = ?, step_data = ?, executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status || existing.status,
      notes !== undefined ? notes : existing.notes,
      JSON.stringify(currentEvidences),
      JSON.stringify(currentStepData),
      id
    );

    return this.getById(id);
  }

  static addEvidence(id, newEvidencePath) {
    const existing = this.getById(id);
    if (!existing) return null;

    // Normalize to forward slashes for consistent storage
    const normalizedPath = String(newEvidencePath || '').replace(/\\/g, '/');

    let evidencePaths = Array.isArray(existing.evidence_paths)
      ? [...existing.evidence_paths]
      : (existing.evidence_path ? [existing.evidence_path] : []);

    evidencePaths.push(normalizedPath);

    db.prepare(`
      UPDATE test_execution_results
      SET evidence_paths = ?, executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(evidencePaths), id);

    return evidencePaths;
  }

  static removeEvidence(id, evidencePathToRemove, baseDir) {
    const existing = this.getById(id);
    if (!existing) return null;

    // Normalize slashes for consistent comparison
    const normalize = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const normalizedTarget = normalize(evidencePathToRemove);

    let evidencePaths = Array.isArray(existing.evidence_paths)
      ? [...existing.evidence_paths]
      : (existing.evidence_path ? [existing.evidence_path] : []);

    evidencePaths = evidencePaths.filter(p => normalize(p) !== normalizedTarget);

    // Try to delete the physical file using the original or normalized path
    if (evidencePathToRemove && baseDir) {
      const candidates = [
        path.join(baseDir, evidencePathToRemove),
        path.join(baseDir, normalizedTarget)
      ];
      for (const fullPath of candidates) {
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
          break;
        }
      }
    }

    db.prepare(`
      UPDATE test_execution_results
      SET evidence_paths = ?
      WHERE id = ?
    `).run(JSON.stringify(evidencePaths), id);

    return evidencePaths;
  }
}

module.exports = TestExecution;
