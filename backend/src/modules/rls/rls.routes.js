const express = require('express');
const rlsController = require('./rls.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

// Apply auth middleware to protect policy management routes
router.use(authMiddleware);

router.post('/policies', rlsController.createPolicy);
router.get('/policies', rlsController.listPolicies);
router.get('/policies/:id', rlsController.getPolicyDetails);
router.put('/policies/:id', rlsController.updatePolicy);
router.delete('/policies/:id', rlsController.deletePolicy);

module.exports = router;
