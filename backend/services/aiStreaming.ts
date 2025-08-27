const { GoogleGenerativeAI } = require('@google/generative-ai');
const { adminDb } = require('../../src/lib/firebase-admin');

interface StreamingUpdate {
    type: 'status' | 'progress' | 'question' | 'complete' | 'error' | 'streaming';
    data: any;
    timestamp: Date;
}

class AIStreamingService {
    private static genAI = new GoogleGenerativeAI(
        process.env.GEMINI_API_KEY || 'AIzaSyCcugOatIzulEJKfWFw99gzHfIMeAhWuGU'
    );

    static async generateQuizWithStreaming(
        sessionId: string,
        extractedTexts: {
            insertText: string;
            questionsText: string;
            markschemeText: string;
        },
        metadata: {
            title: string;
            subject: string;
            examBoard?: string;
            year?: string;
            session?: string;
            paperNumber?: string;
            customInstructions?: string;
        },
        onUpdate?: (update: StreamingUpdate) => void
    ): Promise<any> {
        try {
            // Create a real-time session in Firebase
            const sessionRef = adminDb.collection('ai_generation_sessions').doc(sessionId);
            
            // Initialize session
            await sessionRef.set({
                status: 'initializing',
                startedAt: new Date(),
                metadata,
                progress: 0,
                updates: []
            });

            // Helper function to send updates
            const sendUpdate = async (update: StreamingUpdate) => {
                // Update Firebase
                await sessionRef.update({
                    lastUpdate: update.timestamp,
                    [`updates.${Date.now()}`]: update,
                    ...(update.type === 'status' ? { status: update.data } : {}),
                    ...(update.type === 'progress' ? { progress: update.data } : {})
                });

                // Call callback if provided
                if (onUpdate) {
                    onUpdate(update);
                }
            };

            // Send initial status
            await sendUpdate({
                type: 'status',
                data: 'Analyzing PDFs...',
                timestamp: new Date()
            });

            // Build the prompt
            const prompt = this.buildStreamingPrompt(extractedTexts, metadata);

            await sendUpdate({
                type: 'progress',
                data: 10,
                timestamp: new Date()
            });

            // Initialize the model for streaming
            const model = this.genAI.getGenerativeModel({ 
                model: 'models/gemini-2.5-flash-lite',
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            });

            await sendUpdate({
                type: 'status',
                data: 'Generating quiz questions...',
                timestamp: new Date()
            });

            // Start streaming generation
            const result = await model.generateContentStream(prompt);
            
            let fullText = '';
            let questionCount = 0;
            let lastProgressUpdate = 20;
            let chunkCount = 0;

            // Process stream
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;
                chunkCount++;

                // Send the raw streaming text update
                await sendUpdate({
                    type: 'streaming',
                    data: {
                        text: fullText,
                        chunk: chunkText,
                        chunkNumber: chunkCount
                    },
                    timestamp: new Date()
                });

                // Try to parse questions as they come in
                const questions = this.extractQuestionsFromPartialText(fullText);
                if (questions.length > questionCount) {
                    questionCount = questions.length;
                    
                    // Send the new question
                    await sendUpdate({
                        type: 'question',
                        data: {
                            questionNumber: questionCount,
                            question: questions[questionCount - 1]
                        },
                        timestamp: new Date()
                    });

                    // Update progress based on estimated completion
                    const estimatedProgress = Math.min(20 + (chunkCount * 2), 80);
                    if (estimatedProgress > lastProgressUpdate) {
                        lastProgressUpdate = estimatedProgress;
                        await sendUpdate({
                            type: 'progress',
                            data: estimatedProgress,
                            timestamp: new Date()
                        });
                    }
                }
            }

            await sendUpdate({
                type: 'status',
                data: 'Finalizing quiz...',
                timestamp: new Date()
            });

            // Parse the complete response
            const quizData = this.parseStreamedResponse(fullText, metadata);

            // Add metadata
            quizData.generatedAt = new Date();
            quizData.aiGenerated = true;
            quizData.streamingSession = sessionId;
            quizData.questionCount = quizData.questions.length;
            
            // Calculate total marks
            quizData.metadata.totalMarks = quizData.questions.reduce(
                (total: number, q: any) => total + (q.marks || 1), 0
            );

            await sendUpdate({
                type: 'progress',
                data: 100,
                timestamp: new Date()
            });

            await sendUpdate({
                type: 'complete',
                data: {
                    quizId: sessionId,
                    questionCount: quizData.questions.length,
                    totalMarks: quizData.metadata.totalMarks
                },
                timestamp: new Date()
            });

            // Update session as complete
            await sessionRef.update({
                status: 'completed',
                completedAt: new Date(),
                result: quizData
            });

            return quizData;

        } catch (error) {
            console.error('❌ Error in streaming quiz generation:', error);
            
            // Update session with error
            const sessionRef = adminDb.collection('ai_generation_sessions').doc(sessionId);
            await sessionRef.update({
                status: 'error',
                error: error.message,
                errorAt: new Date()
            });

            if (onUpdate) {
                onUpdate({
                    type: 'error',
                    data: error.message,
                    timestamp: new Date()
                });
            }

            throw error;
        }
    }

    private static buildStreamingPrompt(extractedTexts: any, metadata: any): string {
        return `You are an expert education specialist creating an interactive quiz from IGCSE/GCSE exam materials.

MATERIALS PROVIDED:
**INSERT SHEET:**
${extractedTexts.insertText.substring(0, 2000)}

**QUESTION PAPER:**
${extractedTexts.questionsText.substring(0, 4000)}

**MARK SCHEME:**
${extractedTexts.markschemeText.substring(0, 4000)}

QUIZ METADATA:
- Title: ${metadata.title}
- Subject: ${metadata.subject}
- Exam Board: ${metadata.examBoard || 'N/A'}
- Year: ${metadata.year || 'N/A'}
- Session: ${metadata.session || 'N/A'}

Generate a comprehensive quiz in JSON format with the following structure:
{
    "title": "${metadata.title}",
    "subject": "${metadata.subject}",
    "metadata": {
        "examBoard": "${metadata.examBoard || ''}",
        "year": "${metadata.year || ''}",
        "session": "${metadata.session || ''}",
        "timeLimit": 3600
    },
    "questions": [
        {
            "id": 1,
            "question": "Complete question text",
            "type": "multiple_choice|short_answer|calculation|essay",
            "marks": 2,
            "passage": "Reading passage if applicable",
            "highlightedSentences": [
                {
                    "sentence": "Key sentence",
                    "reason": "Why it's important"
                }
            ],
            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
            "correctAnswer": "B) Option 2",
            "explanation": "Detailed explanation",
            "answerMode": "static|keywords|ai"
        }
    ]
}

Extract ALL questions from the question paper and create a comprehensive quiz.`;
    }

    private static extractQuestionsFromPartialText(text: string): any[] {
        try {
            // Try to find complete questions in the partial text
            const questionMatches = text.match(/"questions"\s*:\s*\[([\s\S]*?)\]/);
            if (!questionMatches) return [];

            const questionsText = `[${questionMatches[1]}]`;
            
            // Try to parse, but handle incomplete JSON
            try {
                // Fix incomplete JSON by closing open brackets
                let fixedText = questionsText;
                const openBraces = (fixedText.match(/{/g) || []).length;
                const closeBraces = (fixedText.match(/}/g) || []).length;
                if (openBraces > closeBraces) {
                    fixedText += '}]}]'.substring(0, openBraces - closeBraces);
                }

                const questions = JSON.parse(fixedText);
                return Array.isArray(questions) ? questions : [];
            } catch {
                return [];
            }
        } catch {
            return [];
        }
    }

    private static parseStreamedResponse(text: string, metadata: any): any {
        try {
            // Extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in AI response');
            }

            const quizData = JSON.parse(jsonMatch[0]);

            // Validate and enhance
            if (!quizData.questions || !Array.isArray(quizData.questions)) {
                throw new Error('Invalid quiz format: questions array required');
            }

            // Ensure all required fields
            quizData.title = quizData.title || metadata.title;
            quizData.subject = quizData.subject || metadata.subject;
            quizData.metadata = {
                ...metadata,
                ...quizData.metadata
            };

            return quizData;
        } catch (error) {
            console.error('Error parsing streamed response:', error);
            throw new Error('Failed to parse AI response');
        }
    }

    // Subscribe to real-time updates from Firebase
    static subscribeToSession(sessionId: string, callback: (update: any) => void): () => void {
        const sessionRef = adminDb.collection('ai_generation_sessions').doc(sessionId);
        
        const unsubscribe = sessionRef.onSnapshot((snapshot: any) => {
            if (snapshot.exists) {
                callback(snapshot.data());
            }
        });

        return unsubscribe;
    }
}

module.exports = { AIStreamingService };
export { }; // Force TypeScript to treat this as a module