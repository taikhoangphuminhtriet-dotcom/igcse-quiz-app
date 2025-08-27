const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { QuizService } = require('../services/quiz');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// GET /api/quizzes - Get all quizzes or by subject
router.get('/', async (req: any, res: any) => {
    try {
        const { subject } = req.query;
        const quizzes = await QuizService.getQuizzes(subject);

        res.json({
            success: true,
            data: quizzes
        });
    } catch (error) {
        console.error('Get quizzes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch quizzes'
        });
    }
});

// GET /api/quizzes/:subject - Get quizzes by subject (must be before /:id)
router.get('/:subject', async (req: any, res: any) => {
    try {
        const { subject } = req.params;
        
        // Check if this is a valid subject or a quiz ID
        const validSubjects = ['Math', 'English', 'Science', 'History', 'Geography'];
        
        if (validSubjects.includes(subject)) {
            // This is a subject filter
            const quizzes = await QuizService.getQuizzes(subject);
            return res.json({
                success: true,
                data: quizzes
            });
        }
        
        // Otherwise, treat it as a quiz ID
        const quiz = await QuizService.getQuizById(subject);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                error: 'Quiz not found'
            });
        }

        res.json({
            success: true,
            data: quiz
        });
    } catch (error) {
        console.error('Get quiz error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch quiz'
        });
    }
});

// POST /api/quizzes/:id/submit - Submit quiz answers
router.post('/:id/submit', verifyToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: 'Valid answers array is required'
            });
        }

        const result = await QuizService.submitQuiz(req.user.uid, id, answers);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit quiz'
        });
    }
});

// GET /api/quizzes/:id/submissions - Get user's submissions for a quiz
router.get('/:id/submissions', verifyToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        const snapshot = await adminDb
            .collection('quiz_submissions')
            .where('userId', '==', req.user.uid)
            .where('quizId', '==', id)
            .orderBy('completedAt', 'desc')
            .limit(10)
            .get();

        const submissions = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch submissions'
        });
    }
});

module.exports = router;
export { }; // Force TypeScript to treat this as a module
