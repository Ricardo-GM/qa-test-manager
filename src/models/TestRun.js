const db = require('../../database');

class TestRun {
  static getAll() {
    return db.prepare('SELECT * FROM test_runs').all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id);
  }

  static create({ name, environment = 'QA', groupId = 'all' }) {
    let targetCases = [];
    if (groupId && groupId !== 'all') {
      targetCases = db.prepare('SELECT id FROM test_cases WHERE group_id = ?').all(groupId);
    } else {
      targetCases = db.prepare('SELECT id FROM test_cases').all();
    }

    if (targetCases.length === 0) {
      throw new Error('No existen casos de prueba en el grupo seleccionado.');
    }

    const createRunTx = db.transaction(() => {
      const runRes = db.prepare('INSERT INTO test_runs (name, environment, group_id) VALUES (?, ?, ?)')
        .run(name, environment || 'QA', groupId || 'all');
      const runId = runRes.lastInsertRowid;

      const insertResultStmt = db.prepare(`
        INSERT INTO test_execution_results (run_id, case_id, status)
        VALUES (?, ?, 'Untested')
      `);

      for (const c of targetCases) {
        insertResultStmt.run(runId, c.id);
      }

      return runId;
    });

    return createRunTx();
  }

  static update(id, { name, environment }) {
    return db.prepare('UPDATE test_runs SET name = ?, environment = ? WHERE id = ?')
      .run(name, environment, id);
  }

  static delete(id) {
    return db.prepare('DELETE FROM test_runs WHERE id = ?').run(id);
  }
}

module.exports = TestRun;
