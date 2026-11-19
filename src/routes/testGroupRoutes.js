const express = require('express');
const router = express.Router();
const TestGroupController = require('../controllers/testGroupController');

router.get('/', TestGroupController.getGroups);
router.delete('/:id', TestGroupController.deleteGroup);

module.exports = router;
