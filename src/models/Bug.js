const db = require('../../database');
const fs = require('fs');
const path = require('path');

class Bug {
  static getAll(filters = {}) {
    let bugs = db.prepare('SELECT * FROM bugs').all();
    const { assigned_to, status, severity, group_id, run_id } = filters;

    if (group_id && group_id !== 'ALL') {
      bugs = bugs.filter(b => String(b.group_id) === String(group_id));
    }
    if (run_id && run_id !== 'ALL') {
      bugs = bugs.filter(b => String(b.run_id) === String(run_id));
    }
    if (assigned_to && assigned_to !== 'ALL') {
      bugs = bugs.filter(b => (b.assigned_to || '').toLowerCase() === assigned_to.toLowerCase());
    }
    if (status && status !== 'ALL') {
      bugs = bugs.filter(b => b.status === status);
    }
    if (severity && severity !== 'ALL') {
      bugs = bugs.filter(b => b.severity === severity);
    }

    return bugs;
  }

  static getById(id) {
    return db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
  }

  static create(data) {
    const {
      run_id,
      case_id,
      result_id,
      title,
      description,
      reproduction,
      expected_result,
      assigned_to,
      severity,
      status,
      evidence_paths
    } = data;

    const stmt = db.prepare(`
      INSERT INTO bugs (run_id, case_id, result_id, title, description, reproduction, expected_result, assigned_to, severity, status, evidence_paths)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      run_id,
      case_id,
      result_id,
      title,
      description,
      reproduction,
      expected_result,
      assigned_to,
      severity,
      status || 'Abierto',
      evidence_paths ? JSON.stringify(evidence_paths) : '[]'
    );

    return res.lastInsertRowid;
  }

  static update(id, data) {
    const {
      run_id,
      case_id,
      result_id,
      title,
      description,
      reproduction,
      expected_result,
      assigned_to,
      severity,
      status,
      evidence_paths
    } = data;

    return db.prepare(`
      UPDATE bugs
      SET run_id = ?, case_id = ?, result_id = ?, title = ?, description = ?, reproduction = ?, expected_result = ?, assigned_to = ?, severity = ?, status = ?, evidence_paths = ?
      WHERE id = ?
    `).run(
      run_id,
      case_id,
      result_id,
      title,
      description,
      reproduction,
      expected_result,
      assigned_to,
      severity,
      status,
      evidence_paths ? JSON.stringify(evidence_paths) : '[]',
      id
    );
  }

  static delete(id) {
    return db.prepare('DELETE FROM bugs WHERE id = ?').run(id);
  }

  static removeEvidence(bugId, evidencePathToRemove, baseDir) {
    const existing = this.getById(bugId);
    if (!existing) return false;

    let evidencePaths = Array.isArray(existing.evidence_paths)
      ? [...existing.evidence_paths]
      : (existing.evidence_path ? [existing.evidence_path] : []);

    evidencePaths = evidencePaths.filter(p => p !== evidencePathToRemove);

    if (evidencePathToRemove && baseDir) {
      const fullPath = path.join(baseDir, evidencePathToRemove);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
      }
    }

    db.prepare('UPDATE bugs SET evidence_paths = ? WHERE id = ?')
      .run(JSON.stringify(evidencePaths), bugId);

    return evidencePaths;
  }
}

module.exports = Bug;
