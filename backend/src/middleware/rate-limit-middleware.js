import rateLimit from 'express-rate-limit';

const generalRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120,   
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    skip: (req) => req.path === '/health'
});

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, 
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many auth requests, please try again later.'
    }
});

export {
    generalRateLimiter,
    authRateLimiter
};