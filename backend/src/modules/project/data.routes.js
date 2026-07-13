const express = require('express');
const dataController = require('./data.controller');

// mergeParams: true ensures that :projectId from the parent router is accessible here
const router = express.Router({ mergeParams: true });

router.post('/:tableName', dataController.insertRecord);
router.get('/:tableName', dataController.listRecords);
router.get('/:tableName/:id', dataController.getRecord);
router.patch('/:tableName/:id', dataController.updateRecord);
router.delete('/:tableName/:id', dataController.deleteRecord);

module.exports = router;
