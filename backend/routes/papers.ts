const express = require('express');
const multer = require('multer');
const { verifyToken, requireDeveloper } = require('../middleware/auth');
const { UploadService } = require('../services/upload');
const { AIService } = require('../services/ai');
const { QuizService } = require('../services/quiz');
const { adminDb } = require('../../src/lib/firebase-admin');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req: any, file: any, cb: any) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files allowed'));
        }
    }
});

// GET /api/papers - Get papers for developer
router.get('/', verifyToken, requireDeveloper, async (req: any, res: any) => {
    try {
        const snapshot = await adminDb
            .collection('papers')
            .where('uploadedBy', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const papers = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: papers
        });
    } catch (error) {
        console.error('Get papers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch papers'
        });
    }
});

// POST /api/papers/upload - Upload PDF
router.post('/upload', verifyToken, requireDeveloper, upload.single('pdf'), async (req: any, res: any) => {
    try {
        const { title, subject } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file provided'
            });
        }

        if (!title || !subject) {
            return res.status(400).json({
                success: false,
                error: 'Title and subject are required'
            });
        }

        // Upload to Cloudinary
        const uploadResult = await UploadService.uploadPDF(
            req.file.buffer,
            req.file.originalname,
            subject
        );

        // Save to database
        const paperData = {
            title,
            subject,
            filename: req.file.originalname,
            pdfUrl: (uploadResult as any).secure_url,
            cloudinaryId: (uploadResult as any).public_id,
            uploadedBy: req.user.uid,
            createdAt: new Date(),
            status: 'uploaded'
        };

        const docRef = await adminDb.collection('papers').add(paperData);

        res.json({
            success: true,
            data: {
                paperId: docRef.id,
                ...paperData
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload PDF'
        });
    }
});

// POST /api/papers/:id/parse - Parse PDF with AI
router.post('/:id/parse', verifyToken, requireDeveloper, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        const paperDoc = await adminDb.collection('papers').doc(id).get();
        if (!paperDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Paper not found'
            });
        }

        const paperData = paperDoc.data();

        // Extract text from PDF
        const text = await AIService.extractTextFromPDF(paperData.pdfUrl);

        // Parse questions with AI
        const questions = await AIService.parseQuestionsFromText(
            text,
            paperData.subject,
            paperData.title
        );

        // Create quiz
        const quizId = await QuizService.createQuiz({
            paperId: id,
            title: paperData.title,
            subject: paperData.subject,
            questions,
            totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
            createdAt: new Date()
        });

        // Update paper status
        await adminDb.collection('papers').doc(id).update({
            status: 'parsed',
            quizId,
            parsedAt: new Date()
        });

        res.json({
            success: true,
            data: {
                quizId,
                questionsCount: questions.length,
                totalMarks: questions.reduce((sum, q) => sum + q.marks, 0)
            }
        });
    } catch (error) {
        console.error('Parse error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to parse PDF'
        });
    }
});

module.exports = router;
export { }; // Force TypeScript to treat this as a module
