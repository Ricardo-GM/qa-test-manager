const express = require('express');
const router = express.Router();
const path = require('path');
const ExecutionController = require('../controllers/executionController');
const { uploadDisk, uploadsDir } = require('../config/multer');

const rootDir = path.join(__dirname, '..', '..');

router.put('/test-execution/:resultId', ExecutionController.updateExecution);

router.post('/upload-evidence', uploadDisk.single('evidence'), (req, res) => {
  ExecutionController.uploadGenericEvidence(req, res, uploadsDir);
});

router.post('/test-execution/:resultId/evidence', uploadDisk.single('evidence'), (req, res) => {
  ExecutionController.addEvidence(req, res, uploadsDir);
});

router.delete('/test-execution/:resultId/evidence', (req, res) => {
  ExecutionController.deleteEvidence(req, res, rootDir);
});

module.exports = router;
