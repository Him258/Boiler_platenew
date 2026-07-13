const express = require('express');
const schemaController = require('./schema.controller');

// mergeParams: true ensures that :projectId from the parent router is accessible here
const router = express.Router({ mergeParams: true });

// 1. Column builder endpoints (most specific paths first)
router.get('/tables/:tableName/columns', schemaController.listColumns);
router.post('/tables/:tableName/columns', schemaController.addColumn);
router.patch('/tables/:tableName/columns/:columnName', schemaController.updateColumn);
router.delete('/tables/:tableName/columns/:columnName', schemaController.dropColumn);

// 2. Expected Table prefix endpoints (preferred new API design)
router.get('/tables', schemaController.listTables);
router.post('/tables', schemaController.createTable);
router.get('/tables/:tableName', schemaController.describeTable);
router.delete('/tables/:tableName', schemaController.dropTable);

// 3. Fallback table endpoints (for backwards compatibility, registered last to prevent parameter conflicts)
router.get('/', schemaController.listTables);
router.post('/', schemaController.createTable);
router.get('/:tableName', schemaController.describeTable);
router.delete('/:tableName', schemaController.dropTable);

module.exports = router;


