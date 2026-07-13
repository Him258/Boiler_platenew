const express = require('express');
const dataController = require('./data.controller');
const { checkPermission } = require('../../middlewares/rbac.middleware');

// mergeParams: true ensures that :projectId from the parent router is accessible here
const router = express.Router({ mergeParams: true });

router.post('/:tableName', checkPermission('database', 'write'), dataController.insertRecord);
router.get('/:tableName', checkPermission('database', 'read'), dataController.listRecords);
router.get('/:tableName/:id', checkPermission('database', 'read'), dataController.getRecord);
router.patch('/:tableName/:id', checkPermission('database', 'write'), dataController.updateRecord);
router.delete('/:tableName/:id', checkPermission('database', 'write'), dataController.deleteRecord);

module.exports = router;
