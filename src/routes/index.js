const express = require('express');
const router = express.Router();

const testGroupRoutes = require('./testGroupRoutes');
const testCaseRoutes = require('./testCaseRoutes');
const testRunRoutes = require('./testRunRoutes');
const executionRoutes = require('./executionRoutes');
const bugRoutes = require('./bugRoutes');

router.use('/test-groups', testGroupRoutes);
router.use('/test-cases', testCaseRoutes);
router.use('/test-runs', testRunRoutes);
router.use('/', executionRoutes);
router.use('/', bugRoutes);

module.exports = router;
