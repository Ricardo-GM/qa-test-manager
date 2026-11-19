const express = require('express');
const router = express.Router();
const path = require('path');
const BugController = require('../controllers/bugController');

const rootDir = path.join(__dirname, '..', '..');

router.get('/bugs', BugController.getBugs);
router.post('/bugs', BugController.createBug);
router.put('/bugs/:id', BugController.updateBug);
router.delete('/bugs/:id', BugController.deleteBug);
router.delete('/bugs/:bugId/evidence', (req, res) => {
  BugController.deleteEvidence(req, res, rootDir);
});
router.get('/bugs/pdf', BugController.exportPdf);

module.exports = router;
