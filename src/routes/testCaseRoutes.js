const express = require('express');
const router = express.Router();
const TestCaseController = require('../controllers/testCaseController');
const { uploadMemory } = require('../config/multer');

router.get('/', TestCaseController.getTestCases);
router.post('/import', uploadMemory.single('excelFile'), TestCaseController.importExcel);
router.post('/import-feature', uploadMemory.array('featureFiles', 50), TestCaseController.importFeature);

module.exports = router;
