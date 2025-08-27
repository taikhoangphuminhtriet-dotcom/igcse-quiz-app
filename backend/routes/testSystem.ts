const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { TestPersistenceService } = require('../services/testPersistence');
const { XPService } = require('../services/xp');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// Start a new test session
router.post('/start-test/:quizId', verifyToken, async (req: any, res: any) => {
    try {
        const { quizId } = req.params;
        const userId = req.user.uid;

        // Get quiz data
        const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
        if (!quizDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Quiz not found'
            });
        }

        const quizData = quizDoc.data();
        const timeLimit = quizData.metadata?.timeLimit || quizData.timeLimit || 3600; // Default 1 hour

        // Check if user already has an active test
        const existingTest = await TestPersistenceService.getActiveTest(userId, quizId);
        if (existingTest) {
            // Calculate remaining time
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - existingTest.startTime.getTime()) / 1000);
            const remaining = Math.max(0, timeLimit - elapsed);

            if (remaining > 0) {
                return res.json({
                    success: true,
                    data: {
                        testSessionId: existingTest.id,
                        resuming: true,
                        timeRemaining: remaining,
                        currentQuestion: existingTest.currentQuestion,
                        quiz: quizData
                    },
                    message: 'Resuming existing test session'
                });
            } else {
                // Test has expired, auto-complete it
                await TestPersistenceService.autoCompleteTest(existingTest.id);
                return res.status(400).json({
                    success: false,
                    error: 'Your previous test session has expired. Please start a new test.'
                });
            }
        }

        // Start new test session
        const testSessionId = await TestPersistenceService.startTest(userId, quizId, timeLimit);

        res.json({
            success: true,
            data: {
                testSessionId,
                timeLimit,
                quiz: quizData,
                resuming: false
            },
            message: 'Test session started successfully'
        });

    } catch (error) {
        console.error('❌ Start test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start test'
        });
    }
});

// Update test progress (save answer)
router.post('/test-progress/:testSessionId', verifyToken, async (req: any, res: any) => {
    try {
        const { testSessionId } = req.params;
        const { questionId, answer, currentQuestion } = req.body;

        await TestPersistenceService.updateTestProgress(testSessionId, questionId, answer, currentQuestion);

        res.json({
            success: true,
            message: 'Progress saved'
        });

    } catch (error) {
        console.error('❌ Update progress error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update progress'
        });
    }
});

// Complete test session
router.post('/complete-test/:testSessionId', verifyToken, async (req: any, res: any) => {
    try {
        const { testSessionId } = req.params;
        const { answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: 'Valid answers array is required'
            });
        }

        const result = await TestPersistenceService.completeTest(testSessionId, answers);

        res.json({
            success: true,
            data: result,
            message: 'Test completed successfully'
        });

    } catch (error) {
        console.error('❌ Complete test error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to complete test'
        });
    }
});

// Get current test session status
router.get('/test-session/:testSessionId', verifyToken, async (req: any, res: any) => {
    try {
        const { testSessionId } = req.params;

        const testSession = await TestPersistenceService.getTestSession(testSessionId);
        if (!testSession) {
            return res.status(404).json({
                success: false,
                error: 'Test session not found'
            });
        }

        // Check if user owns this test session
        if (testSession.userId !== req.user.uid) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Calculate remaining time
        const now = new Date();
        // Convert Firestore Timestamp to Date if needed
        const startTime = testSession.startTime instanceof Date ? testSession.startTime : (testSession.startTime as any).toDate();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const remaining = Math.max(0, testSession.timeLimit - elapsed);

        res.json({
            success: true,
            data: {
                ...testSession,
                timeElapsed: elapsed,
                timeRemaining: remaining,
                expired: remaining === 0
            }
        });

    } catch (error) {
        console.error('❌ Get test session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get test session'
        });
    }
});

// Get user's test history
router.get('/test-history', verifyToken, async (req: any, res: any) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit as string) || 20;

        const history = await XPService.getUserHistory(userId, limit);

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('❌ Get history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get test history'
        });
    }
});

// Get user's XP and stats
router.get('/user-stats', verifyToken, async (req: any, res: any) => {
    try {
        const userId = req.user.uid;

        // Get user data
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const totalXP = userData.totalXP || 0;

        // Get recent history for stats
        const recentHistory = await XPService.getUserHistory(userId, 10);

        // Calculate stats
        const totalTests = recentHistory.length;
        const passedTests = recentHistory.filter(h => h.status === 'pass').length;
        const failedTests = totalTests - passedTests;
        const averageScore = totalTests > 0
            ? recentHistory.reduce((sum, h) => sum + h.score, 0) / totalTests
            : 0;

        const stats = {
            totalXP,
            totalTests,
            passedTests,
            failedTests,
            passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
            averageScore: Math.round(averageScore * 100) / 100,
            recentHistory: recentHistory.slice(0, 5) // Last 5 tests
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Get user stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user stats'
        });
    }
});

// Force complete expired tests (admin cleanup)
router.post('/cleanup-tests', verifyToken, async (req: any, res: any) => {
    try {
        // Check if user is admin/owner
        const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
        const userData = userDoc.data();

        if (!userData || (userData.role !== 'owner' && userData.role !== 'developer')) {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        await TestPersistenceService.cleanupOldTests(7); // Clean tests older than 7 days

        res.json({
            success: true,
            message: 'Test cleanup completed'
        });

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup tests'
        });
    }
});

// Get leaderboard (XP-based)
router.get('/leaderboard', async (req: any, res: any) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const usersSnapshot = await adminDb.collection('users')
            .where('totalXP', '>', 0)
            .orderBy('totalXP', 'desc')
            .limit(limit)
            .get();

        const leaderboard = usersSnapshot.docs.map((doc: any, index: number) => {
            const userData = doc.data();
            return {
                rank: index + 1,
                username: userData.username || 'Anonymous',
                totalXP: userData.totalXP || 0,
                uid: doc.id
            };
        });

        res.json({
            success: true,
            data: leaderboard
        });

    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard'
        });
    }
});

module.exports = router;
export { }; // Force TypeScript to treat this as a module
