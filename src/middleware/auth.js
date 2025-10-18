const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  console.log('\n🔐 [ITINERARY-AUTH] Authenticating request');
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ [ITINERARY-AUTH] No token provided');
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  console.log('🔍 [ITINERARY-AUTH] Token found, verifying...');
  console.log('🔑 [ITINERARY-AUTH] Token preview:', token.substring(0, 20) + '...');
  console.log('🔑 [ITINERARY-AUTH] JWT_SECRET configured:', process.env.JWT_SECRET ? 'Yes' : 'No');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ [ITINERARY-AUTH] Token verification failed:', err.message);
      console.log('❌ [ITINERARY-AUTH] Error name:', err.name);
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    console.log('✅ [ITINERARY-AUTH] Token verified successfully');
    console.log('👤 [ITINERARY-AUTH] User:', { id: user.id || user.userId, email: user.email });
    
    req.user = user; // Add user info to request
    next();
  });
};

module.exports = { authenticateToken };
