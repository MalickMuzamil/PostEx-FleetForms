// Helper to check if user has required role(s)
export const hasRole = (userRoles = [], requiredRoles = []) => {
    if (!Array.isArray(userRoles) || !Array.isArray(requiredRoles)) return false;
    
    const normalized = userRoles.map(r => String(r || '').toLowerCase().trim());
    const required = requiredRoles.map(r => String(r || '').toLowerCase().trim());
    
    return required.some(r => normalized.includes(r));
};

// Middleware factory for role-based access control
export const requireRole = (allowedRoles = []) => {
    return (req, res, next) => {
        const userRoles = req.user?.roles || [];
        
        if (!hasRole(userRoles, allowedRoles)) {
            return res.status(403).json({
                message: `Access denied. Required roles: ${allowedRoles.join(' or ')}`,
                code: "FORBIDDEN",
            });
        }
        
        next();
    };
};
