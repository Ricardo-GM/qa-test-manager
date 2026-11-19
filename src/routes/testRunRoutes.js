const express = require('express');
const router = express.Router();
const TestRunController = require('../controllers/testRunController');
const { uploadMemory } = require('../config/multer');

router.get('/', TestRunController.getRuns);
router.get('/:id', TestRunController.getRunById);
router.post('/', TestRunController.createRun);
router.put('/:id', TestRunController.updateRun);
router.delete('/:id', TestRunController.deleteRun);
router.get('/:id/pdf', TestRunController.exportPdf);

// Endpoint de importación de Allure Report
router.post('/:id/import-allure', uploadMemory.array('allureFiles', 200), TestRunController.importAllureResults);

module.exports = router;
