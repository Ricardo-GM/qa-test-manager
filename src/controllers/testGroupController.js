const TestGroup = require('../models/TestGroup');

class TestGroupController {
  static getGroups(req, res) {
    try {
      const groups = TestGroup.getAll();
      res.json(groups);
    } catch (error) {
      console.error('Error obteniendo grupos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteGroup(req, res) {
    try {
      const { id } = req.params;
      TestGroup.delete(id);
      res.json({ success: true, message: 'Grupo de casos y sus casos asociados fueron eliminados exitosamente.' });
    } catch (error) {
      console.error('Error eliminando Grupo:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = TestGroupController;
