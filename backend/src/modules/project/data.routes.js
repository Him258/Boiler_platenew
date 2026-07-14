const express = require('express');
const dataController = require('./data.controller');
const { checkPermission } = require('../../middlewares/rbac.middleware');
const checkRowPermission = require('../../middlewares/rls.middleware');

// mergeParams: true ensures that :projectId from the parent router is accessible here
const router = express.Router({ mergeParams: true });

router.post('/:tableName', checkPermission('database', 'write'), checkRowPermission, dataController.insertRecord);
router.get('/:tableName', checkPermission('database', 'read'), checkRowPermission, dataController.listRecords);
router.get('/:tableName/:id', checkPermission('database', 'read'), checkRowPermission, dataController.getRecord);
router.patch('/:tableName/:id', checkPermission('database', 'write'), checkRowPermission, dataController.updateRecord);
router.delete('/:tableName/:id', checkPermission('database', 'write'), checkRowPermission, dataController.deleteRecord);

module.exports = router;
