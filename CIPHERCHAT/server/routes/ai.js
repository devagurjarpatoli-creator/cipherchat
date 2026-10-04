const express = require('express');
const router = express.Router();
const { handleAIRequest } = require('../controllers/aiController');

router.post('/prompt', handleAIRequest);

module.exports = router;