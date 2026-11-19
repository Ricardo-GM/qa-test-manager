const db = require('../../database');

class TestCase {
  static getAll(groupId = null) {
    if (groupId && groupId !== 'all') {
      return db.prepare('SELECT * FROM test_cases WHERE group_id = ?').all(groupId);
    }
    return db.prepare('SELECT * FROM test_cases').all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
  }

  static findByGroup(groupId) {
    if (!groupId || groupId === 'all') {
      return db.prepare('SELECT * FROM test_cases').all();
    }
    return db.prepare('SELECT * FROM test_cases WHERE group_id = ?').all(groupId);
  }

  static create({ groupId, caseNumber, title, summary, gherkinSteps, priority = 'Media' }) {
    const stmt = db.prepare(`
      INSERT INTO test_cases (group_id, case_number, title, summary, gherkin_steps, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(groupId, caseNumber, title, summary, gherkinSteps, priority);
    return {
      id: res.lastInsertRowid,
      groupId,
      caseNumber,
      title,
      summary,
      gherkinSteps,
      priority
    };
  }

  static createMany(groupId, casesList) {
    const insertStmt = db.prepare(`
      INSERT INTO test_cases (group_id, case_number, title, summary, gherkin_steps, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertTransaction = db.transaction((list) => {
      let insertedCount = 0;
      for (const tc of list) {
        insertStmt.run(
          groupId,
          tc.case_number || tc.caseNumber,
          tc.title || '',
          tc.summary || '',
          tc.gherkin_steps || tc.gherkinSteps || '',
          tc.priority || 'Media'
        );
        insertedCount++;
      }
      return insertedCount;
    });

    return insertTransaction(casesList);
  }
}

module.exports = TestCase;
