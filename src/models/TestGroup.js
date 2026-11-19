const db = require('../../database');

class TestGroup {
  static getAll() {
    return db.prepare('SELECT * FROM test_groups').all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM test_groups WHERE id = ?').get(id);
  }

  static create(name) {
    const res = db.prepare('INSERT INTO test_groups (name) VALUES (?)').run(name);
    return {
      id: res.lastInsertRowid,
      name
    };
  }

  static delete(id) {
    return db.prepare('DELETE FROM test_groups WHERE id = ?').run(id);
  }
}

module.exports = TestGroup;
