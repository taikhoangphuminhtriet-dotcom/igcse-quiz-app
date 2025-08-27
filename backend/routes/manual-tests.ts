const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireDeveloper, requireOwner } = require('../middleware/auth');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// Helper middleware to allow both developers and owners
const requireDeveloperOrOwner = async (req: any, res: any, next: any) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        // Check if user has proper permission
        const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) {
            return res.status(403).json({
                success: false,
                error: 'User profile not found'
            });
        }

        const userData = userDoc.data();
        const userRole = userData?.role;

        if (userRole !== 'developer' && userRole !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Developer or Owner access required'
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

// Create manual test
router.post('/manual-test',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            console.log('📝 Creating manual test...');

            const {
                title,
                subject,
                description,
                timeLimit,
                totalMarks,
                instructions,
                questions
            } = req.body;

            // Validate required fields
            if (!title || !subject || !questions || questions.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Title, subject, and at least one question are required'
                });
            }

            // Validate questions
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                if (!question.question || !question.type || !question.marks) {
                    return res.status(400).json({
                        success: false,
                        error: `Question ${i + 1} is missing required fields`
                    });
                }

                if (question.type === 'multiple_choice') {
                    if (!question.options || question.options.length < 2) {
                        return res.status(400).json({
                            success: false,
                            error: `Question ${i + 1} needs at least 2 options for multiple choice`
                        });
                    }
                    if (question.correctAnswer === undefined || question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
                        return res.status(400).json({
                            success: false,
                            error: `Question ${i + 1} has invalid correct answer selection`
                        });
                    }
                } else {
                    if (!question.correctAnswer || question.correctAnswer.trim() === '') {
                        return res.status(400).json({
                            success: false,
                            error: `Question ${i + 1} needs a correct answer`
                        });
                    }
                }
            }

            // Create quiz document
            const quizId = uuidv4();
            const quizData = {
                id: quizId,
                title,
                subject,
                description: description || '',
                timeLimit: timeLimit || 60,
                totalMarks: totalMarks || questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0),
                instructions: instructions || '',
                questions: questions.map((q: any, index: number) => ({
                    ...q,
                    id: q.id || `q${index + 1}`,
                    questionNumber: index + 1
                })),
                createdBy: req.user.uid,
                createdAt: new Date(),
                lastModified: new Date(),
                status: 'published',
                type: 'manual',
                questionCount: questions.length,
                metadata: {
                    difficulty: 'Mixed',
                    examBoard: 'Custom',
                    year: new Date().getFullYear(),
                    session: 'Custom'
                }
            };

            // Save to Firestore
            await adminDb.collection('quizzes').doc(quizId).set(quizData);

            console.log(`✅ Manual test created: ${quizId} with ${questions.length} questions`);

            res.json({
                success: true,
                data: {
                    quizId,
                    title,
                    questionCount: questions.length,
                    totalMarks: quizData.totalMarks
                },
                message: `Successfully created test with ${questions.length} questions`
            });

        } catch (error) {
            console.error('❌ Manual test creation error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create manual test'
            });
        }
    }
);

// Get user's manual tests
router.get('/manual-tests',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const testsSnapshot = await adminDb.collection('quizzes')
                .where('createdBy', '==', req.user.uid)
                .where('type', '==', 'manual')
                .orderBy('createdAt', 'desc')
                .get();

            const tests = testsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title,
                    subject: data.subject,
                    questionCount: data.questionCount,
                    totalMarks: data.totalMarks,
                    status: data.status,
                    createdAt: data.createdAt,
                    lastModified: data.lastModified
                };
            });

            res.json({
                success: true,
                data: tests
            });

        } catch (error) {
            console.error('❌ Error fetching manual tests:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch manual tests'
            });
        }
    }
);

// Update manual test
router.put('/manual-test/:testId',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { testId } = req.params;
            const updateData = req.body;

            // Validate test exists and belongs to user
            const testDoc = await adminDb.collection('quizzes').doc(testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Test not found'
                });
            }

            const testData = testDoc.data();
            if (testData.createdBy !== req.user.uid) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only edit your own tests'
                });
            }

            // Update test
            await adminDb.collection('quizzes').doc(testId).update({
                ...updateData,
                lastModified: new Date(),
                modifiedBy: req.user.uid
            });

            res.json({
                success: true,
                message: 'Test updated successfully'
            });

        } catch (error) {
            console.error('❌ Manual test update error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update test'
            });
        }
    }
);

// Delete manual test
router.delete('/manual-test/:testId',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { testId } = req.params;

            // Validate test exists and belongs to user
            const testDoc = await adminDb.collection('quizzes').doc(testId).get();
            if (!testDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Test not found'
                });
            }

            const testData = testDoc.data();
            if (testData.createdBy !== req.user.uid) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own tests'
                });
            }

            // Delete test
            await adminDb.collection('quizzes').doc(testId).delete();

            res.json({
                success: true,
                message: 'Test deleted successfully'
            });

        } catch (error) {
            console.error('❌ Manual test delete error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete test'
            });
        }
    }
);

module.exports = router;
export { }; // Force TypeScript to treat this as a module
