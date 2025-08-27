const { adminAuth, adminDb } = require('../../src/lib/firebase-admin');
const { OwnerService } = require('../services/owner');

const verifyToken = async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
};

const requireDeveloper = async (req: any, res: any, next: any) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        const { adminDb } = require('../../src/lib/firebase-admin');
        const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
        const userData = userDoc.data();

        if (!userData || userData.role !== 'developer') {
            return res.status(403).json({
                success: false,
                error: 'Developer access required'
            });
        }

        next();
    } catch (error) {
        console.error('Developer check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify developer status'
        });
    }
};

const requireOwner = async (req: any, res: any, next: any) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        const isOwner = await OwnerService.isOwner(req.user.uid);
        
        if (!isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Owner access required'
            });
        }

        req.isOwner = true;
        next();
    } catch (error) {
        console.error('Owner check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify owner status'
        });
    }
};

const requirePermission = (permission: string) => {
    return async (req: any, res: any, next: any) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated'
                });
            }

            const hasPermission = await OwnerService.hasPermission(req.user.uid, permission);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: `Permission denied: ${permission}`
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify permissions'
            });
        }
    };
};

module.exports = { verifyToken, requireDeveloper, requireOwner, requirePermission };
export { }; // Force TypeScript to treat this as a module
