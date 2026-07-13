const rateLimitMap = new Map();

/**
 * Basic in-memory rate limiter middleware.
 * @param {Object} options 
 * @param {number} options.windowMs - Time frame in ms (default: 15 minutes)
 * @param {number} options.max - Maximum requests allowed per IP in windowMs (default: 100)
 */
const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 100;

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }

    // Filter out timestamps outside the sliding window
    const requests = rateLimitMap.get(ip).filter(timestamp => now - timestamp < windowMs);
    requests.push(now);
    rateLimitMap.set(ip, requests);

    if (requests.length > max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests, please try again later.'
        }
      });
    }

    next();
  };
};

module.exports = rateLimiter;
