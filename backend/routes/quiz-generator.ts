const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireDeveloper, requireOwner } = require('../middleware/auth');
const { PDFReaderService } = require('../services/pdfReader');
const { AIService } = require('../services/ai');
const { AIStreamingService } = require('../services/aiStreaming');
const { CloudinaryService } = require('../services/cloudinary');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    }
});

// Generate quiz from multiple PDFs
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

router.post('/generate-quiz-from-pdfs',
    verifyToken,
    requireDeveloperOrOwner,
    upload.fields([
        { name: 'insert', maxCount: 1 },
        { name: 'questions', maxCount: 1 },
        { name: 'markscheme', maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            console.log('🚀 Starting multi-PDF quiz generation...');

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const { title, subject, examBoard, year, session, paperNumber, customInstructions } = req.body;

            // Validate required files - ALL 3 PDFS ARE REQUIRED
            if (!files.insert || !files.questions || !files.markscheme) {
                return res.status(400).json({
                    success: false,
                    error: 'All 3 PDFs are required: Insert Sheet, Questions Paper, and Mark Scheme'
                });
            }

            // Validate required metadata
            if (!title || !subject) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and subject are required'
                });
            }

            // Extract file paths - ALL 3 FILES ARE REQUIRED
            const filePaths: { [key: string]: string } = {
                insert: files.insert[0].path,
                questions: files.questions[0].path,
                markscheme: files.markscheme[0].path
            };

            console.log('📁 File paths:', filePaths);

            // Upload PDFs to Cloudinary for persistent storage
            console.log('📤 Uploading PDFs to Cloudinary...');
            const pdfUrls = await CloudinaryService.uploadMultiplePDFs(filePaths);

            // Extract text from PDFs
            const extractedTexts = await PDFReaderService.extractTextFromMultiplePDFs(filePaths);

            // Analyze question structure
            const analysis = await PDFReaderService.analyzeQuestionStructure(extractedTexts.questionsText);
            console.log('📊 Question analysis:', analysis);

            // Generate quiz using AI with custom instructions
            const metadata = {
                title,
                subject,
                examBoard,
                year,
                session,
                paperNumber,
                customInstructions: customInstructions || '' // Include custom instructions
            };

            const generatedQuiz = await AIService.generateQuizFromMultiplePDFs(extractedTexts, metadata);

            // Save quiz to database
            const quizId = uuidv4();
            const quizData = {
                id: quizId,
                ...generatedQuiz,
                createdBy: req.user.uid,
                createdAt: new Date(),
                status: 'draft', // Owner can review before publishing
                analysis,
                sourceFiles: {
                    insert: files.insert[0].filename,
                    questions: files.questions[0].filename,
                    markscheme: files.markscheme[0].filename
                },
                pdfUrls: pdfUrls // Include Cloudinary URLs
            };

            await adminDb.collection('quizzes').doc(quizId).set(quizData);

            // Clean up temporary files
            setTimeout(() => {
                Object.values(filePaths).forEach(filePath => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            }, 5000); // Clean up after 5 seconds

            console.log(`✅ Quiz generated successfully: ${quizId}`);

            res.json({
                success: true,
                data: {
                    quizId,
                    ...generatedQuiz,
                    analysis,
                    pdfUrls // Include PDF URLs in response
                },
                message: `Successfully generated quiz with ${generatedQuiz.questions.length} questions`
            });

        } catch (error) {
            console.error('❌ Multi-PDF quiz generation error:', error);

            // Clean up files on error
            if (req.files) {
                const files = req.files as { [fieldname: string]: Express.Multer.File[] };
                Object.values(files).flat().forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }

            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate quiz from PDFs'
            });
        }
    }
);

// Generate quiz with streaming (SSE)
router.post('/generate-quiz-streaming',
    verifyToken,
    requireDeveloperOrOwner,
    upload.fields([
        { name: 'insert', maxCount: 1 },
        { name: 'questions', maxCount: 1 },
        { name: 'markscheme', maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            console.log('🚀 Starting streaming quiz generation...');

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const { title, subject, examBoard, year, session, paperNumber, customInstructions } = req.body;

            // Validate required files
            if (!files.insert || !files.questions || !files.markscheme) {
                return res.status(400).json({
                    success: false,
                    error: 'All 3 PDFs are required'
                });
            }

            // Validate metadata
            if (!title || !subject) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and subject are required'
                });
            }

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Send initial connection message
            res.write(`data: ${JSON.stringify({ type: 'connected', sessionId: uuidv4() })}\n\n`);

            const sessionId = uuidv4();
            const filePaths = {
                insert: files.insert[0].path,
                questions: files.questions[0].path,
                markscheme: files.markscheme[0].path
            };

            // Upload PDFs to Cloudinary
            res.write(`data: ${JSON.stringify({ type: 'status', data: 'Uploading PDFs...' })}\n\n`);
            const pdfUrls = await CloudinaryService.uploadMultiplePDFs(filePaths);

            // Extract text
            res.write(`data: ${JSON.stringify({ type: 'status', data: 'Extracting text from PDFs...' })}\n\n`);
            const extractedTexts = await PDFReaderService.extractTextFromMultiplePDFs(filePaths);

            const metadata = {
                title,
                subject,
                examBoard,
                year,
                session,
                paperNumber,
                customInstructions
            };

            // Generate quiz with streaming
            const generatedQuiz = await AIStreamingService.generateQuizWithStreaming(
                sessionId,
                extractedTexts,
                metadata,
                (update) => {
                    // Send updates via SSE
                    res.write(`data: ${JSON.stringify(update)}\n\n`);
                }
            );

            // Save quiz to database
            const quizId = uuidv4();
            const quizData = {
                id: quizId,
                ...generatedQuiz,
                createdBy: req.user.uid,
                createdAt: new Date(),
                status: 'draft',
                sourceFiles: {
                    insert: files.insert[0].filename,
                    questions: files.questions[0].filename,
                    markscheme: files.markscheme[0].filename
                },
                pdfUrls
            };

            await adminDb.collection('quizzes').doc(quizId).set(quizData);

            // Send final success message
            res.write(`data: ${JSON.stringify({
                type: 'success',
                data: {
                    quizId,
                    questionCount: generatedQuiz.questions.length,
                    totalMarks: generatedQuiz.metadata.totalMarks
                }
            })}\n\n`);

            // Clean up files
            setTimeout(() => {
                Object.values(filePaths).forEach(filePath => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            }, 5000);

            res.end();

        } catch (error) {
            console.error('❌ Streaming generation error:', error);
            res.write(`data: ${JSON.stringify({
                type: 'error',
                data: error.message
            })}\n\n`);
            res.end();
        }
    }
);

// Review and enhance quiz
router.post('/review-quiz/:quizId',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { quizId } = req.params;
            const { feedback } = req.body;

            // Get current quiz data
            const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
            if (!quizDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            const currentQuiz = quizDoc.data();

            // Enhance quiz using AI
            const enhancedQuiz = await AIService.reviewAndEnhanceQuiz(currentQuiz, feedback);

            // Update quiz in database
            await adminDb.collection('quizzes').doc(quizId).update({
                ...enhancedQuiz,
                lastModified: new Date(),
                modifiedBy: req.user.uid
            });

            res.json({
                success: true,
                data: enhancedQuiz,
                message: 'Quiz reviewed and enhanced successfully'
            });

        } catch (error) {
            console.error('❌ Quiz review error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to review quiz'
            });
        }
    }
);

// Update quiz (manual editing)
router.put('/quiz/:quizId',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { quizId } = req.params;
            const updateData = req.body;

            // Validate quiz exists
            const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
            if (!quizDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Update quiz
            await adminDb.collection('quizzes').doc(quizId).update({
                ...updateData,
                lastModified: new Date(),
                modifiedBy: req.user.uid
            });

            res.json({
                success: true,
                message: 'Quiz updated successfully'
            });

        } catch (error) {
            console.error('❌ Quiz update error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update quiz'
            });
        }
    }
);

// Publish quiz (make it available to students)
router.post('/publish-quiz/:quizId',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { quizId } = req.params;

            // Validate quiz exists
            const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
            if (!quizDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Publish quiz
            await adminDb.collection('quizzes').doc(quizId).update({
                status: 'published',
                publishedAt: new Date(),
                publishedBy: req.user.uid
            });

            res.json({
                success: true,
                message: 'Quiz published successfully'
            });

        } catch (error) {
            console.error('❌ Quiz publish error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to publish quiz'
            });
        }
    }
);

// Get all quizzes for developers (including drafts)
router.get('/all-quizzes',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const { status } = req.query;
            let query = adminDb.collection('quizzes');
            
            if (status) {
                query = query.where('status', '==', status);
            }
            
            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();

            const quizzes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.json({
                success: true,
                data: quizzes
            });

        } catch (error) {
            console.error('❌ Get all quizzes error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch quizzes'
            });
        }
    }
);

// Get owner's drafts
router.get('/drafts',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const draftsSnapshot = await adminDb.collection('quizzes')
                .where('createdBy', '==', req.user.uid)
                .where('status', '==', 'draft')
                .orderBy('createdAt', 'desc')
                .get();

            const drafts = draftsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.json({
                success: true,
                data: drafts
            });

        } catch (error) {
            console.error('❌ Error fetching drafts:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch draft quizzes'
            });
        }
    }
);

// Save generated quiz (after review/edit)
router.post('/save-generated-quiz',
    verifyToken,
    requireDeveloperOrOwner,
    async (req, res) => {
        try {
            const quizData = req.body;

            // Generate quiz ID if not provided
            const quizId = quizData.quizId || uuidv4();

            // Prepare quiz document
            const finalQuizData = {
                id: quizId,
                ...quizData,
                createdBy: req.user.uid,
                createdAt: quizData.createdAt || new Date(),
                lastModified: new Date(),
                status: 'published', // Make it available to students
                type: 'ai_generated'
            };

            // Save to Firestore
            await adminDb.collection('quizzes').doc(quizId).set(finalQuizData);

            console.log(`✅ Quiz saved successfully: ${quizId}`);

            res.json({
                success: true,
                data: {
                    quizId,
                    title: quizData.title,
                    questionCount: quizData.questions.length
                },
                message: 'Quiz saved and published successfully'
            });

        } catch (error) {
            console.error('❌ Save quiz error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to save quiz'
            });
        }
    }
);

module.exports = router;
export { }; // Force TypeScript to treat this as a module
