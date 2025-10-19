const express = require('express');
const router = express.Router();
const myTripsController = require('../controllers/myTrips.controller');
const { authenticateToken } = require('../middleware/auth');

// All my trips endpoints require authentication
router.get('/summary', authenticateToken, myTripsController.getMyTrips);
router.get('/trip/:id', authenticateToken, myTripsController.getTripDetails);
router.get('/:category', authenticateToken, myTripsController.getTripsByCategory);

module.exports = router;
