const express = require('express');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// GET /api/leaderboard/:subject - Get leaderboard for subject
router.get('/:subject', async (req: any, res: any) => {
    try {
        const { subject } = req.params;

        const doc = await adminDb.collection('leaderboards').doc(subject).get();

        if (!doc.exists) {
            return res.json({
                success: true,
                data: {
                    subject,
                    topScores: []
                }
            });
        }

        res.json({
            success: true,
            data: doc.data()
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

// GET /api/leaderboard - Get all subjects leaderboards
router.get('/', async (req: any, res: any) => {
    try {
        const snapshot = await adminDb.collection('leaderboards').get();

        const leaderboards = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: leaderboards
        });
    } catch (error) {
        console.error('Get leaderboards error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboards'
        });
    }
});

module.exports = router;
export { }; // Force TypeScript to treat this as a module
