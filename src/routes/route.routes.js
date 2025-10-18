const express = require('express');
const router = express.Router();
const routeController = require('../controllers/route.controller');
const { authenticateToken } = require('../middleware/auth');

// All route endpoints require authentication
router.post('/calculate/:itineraryId', authenticateToken, routeController.calculateRoutes);
router.get('/itinerary/:itineraryId', authenticateToken, routeController.getItineraryRoutes);
router.get('/itinerary/:itineraryId/compare', authenticateToken, routeController.compareRoutes);
router.get('/:routeId', authenticateToken, routeController.getRoute);

module.exports = router;
