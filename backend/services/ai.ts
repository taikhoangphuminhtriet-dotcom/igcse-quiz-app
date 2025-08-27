const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');

class AIService {
    private static genAI = new GoogleGenerativeAI(
        process.env.GEMINI_API_KEY || 'AIzaSyCcugOatIzulEJKfWFw99gzHfIMeAhWuGU'
    );

    static async extractTextFromPDF(pdfUrl: string): Promise<string> {
        try {
            const response = await fetch(pdfUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const pdfData = await pdfParse(buffer);
            return pdfData.text;
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    static async parseQuestionsFromText(text: string, subject: string, title: string): Promise<any[]> {
        try {
            console.log(`📚 Parsing questions for ${subject} - ${title}`);
            const optimizedText = this.optimizeTextForAI(text);
            const prompt = this.buildPrompt(optimizedText, subject, title);

            const model = this.genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-lite' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const aiText = response.text();

            const questions = this.parseAIResponse(aiText, subject, title);
            console.log(`✅ Generated ${questions.length} questions`);
            return questions;
        } catch (error) {
            console.error('AI parsing error:', error);
            return this.generateFallbackQuestions(subject, title);
        }
    }

    private static optimizeTextForAI(text: string): string {
        // Clean and format text for better AI processing
        let cleaned = text.replace(/\s+/g, ' ').trim();

        // Limit text size for API constraints (around 8000 chars)
        if (cleaned.length > 8000) {
            const truncated = cleaned.substring(0, 8000);
            // Try to end at a complete sentence
            const lastSentence = truncated.lastIndexOf('.');
            return lastSentence > 5000 ? truncated.substring(0, lastSentence + 1) : truncated;
        }

        return cleaned;
    }

    private static buildPrompt(text: string, subject: string, title: string): string {
        return `
Create multiple-choice and short-answer questions from this ${subject} content:

Guidelines:
- Extract 8-12 questions from the text
- Use multiple choice (4 options A,B,C,D) and short answer formats
- Questions should test understanding, not just memorization
- Include difficulty range: easy (1-3 marks), medium (4-6 marks), hard (7-10 marks)
- Focus on key concepts and problem-solving
- Assign appropriate marks (1-10 based on complexity)

Subject: ${subject}
Paper: ${title}

Text:
${text}

Return format:
[{"id":"q1","type":"mcq","question":"...","options":["A","B","C","D"],"correctAnswer":0,"marks":2}]
    `.trim();
    }

    private static parseAIResponse(aiText: string, subject: string, title: string): any[] {
        try {
            // Extract JSON from AI response
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const questions = JSON.parse(jsonMatch[0]);

            // Validate and normalize questions
            return questions.map((q: any, index: number) => ({
                id: q.id || `q${index + 1}`,
                type: this.validateQuestionType(q.type),
                question: q.question || `Question ${index + 1}`,
                options: q.type === 'mcq' ? (q.options || this.generateDefaultOptions()) : undefined,
                correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer :
                    (q.type === 'mcq' ? 0 : 'Sample answer'),
                marks: this.validateMarks(q.marks),
                explanation: q.explanation || 'Answer explanation would be provided here.',
                subject: subject,
                source: title
            }));
        } catch (error) {
            console.error('JSON parsing error:', error);
            return this.generateFallbackQuestions(subject, title);
        }
    }

    private static validateQuestionType(type: string): 'mcq' | 'short_answer' | 'essay' {
        const validTypes = ['mcq', 'short_answer', 'essay'];
        return validTypes.includes(type) ? type as any : 'short_answer';
    }

    private static validateMarks(marks: any): number {
        const numMarks = parseInt(marks);
        return (numMarks >= 1 && numMarks <= 10) ? numMarks : 2;
    }

    private static generateDefaultOptions(): string[] {
        return ['Option A', 'Option B', 'Option C', 'Option D'];
    }

    private static generateFallbackQuestions(subject: string, title: string): any[] {
        return [
            {
                id: 'fallback1',
                type: 'mcq',
                question: `What is a key concept in ${subject}?`,
                options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'],
                correctAnswer: 0,
                marks: 2,
                explanation: 'This is a sample question generated when AI parsing fails.',
                subject: subject,
                source: title
            },
            {
                id: 'fallback2',
                type: 'short_answer',
                question: `Explain a key principle in ${subject}.`,
                correctAnswer: 'Sample detailed answer explaining the principle.',
                marks: 5
            }
        ];
    }

    static async generateQuizFromMultiplePDFs(
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
        }
    ): Promise<any> {
        try {
            console.log('🤖 Generating comprehensive quiz from multiple PDFs...');

            // Enhanced prompt for better quiz generation
            const prompt = `You are an expert education specialist creating an interactive quiz from IGCSE/GCSE exam materials.

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

CUSTOM INSTRUCTIONS:
${metadata.customInstructions || 'No specific custom instructions provided.'}

INSTRUCTIONS:
Create a comprehensive interactive quiz with reading comprehension format like ReadTheory:

1. **READING PASSAGES**: Create detailed reading passages for comprehension questions
2. **QUESTION EXTRACTION**: Extract ALL questions from the question paper exactly as written
3. **ANSWER INTEGRATION**: Use the mark scheme to create accurate answers and explanations
4. **QUESTION TYPES**: Support multiple choice, short answer, calculation, and essay questions
5. **HIGHLIGHTED FOCUS**: For each question, identify key sentences in passages that students should focus on
6. **ANSWER MODES**: Intelligently choose the best answer checking mode:
   - Static: For exact answers that must match precisely
   - Keywords: For flexible answers where multiple correct variations exist
   - AI: For complex answers requiring understanding and context
7. **DETAILED EXPLANATIONS**: Provide step-by-step explanations using the mark scheme
8. **MARKING CRITERIA**: Include mark allocation and grading rubrics
9. **PASSAGE STRUCTURE**: Create engaging passages with clear focus areas for better comprehension
10. **CUSTOM COMPLIANCE**: Follow any custom instructions provided above

OUTPUT FORMAT (JSON):
{
    "title": "${metadata.title}",
    "subject": "${metadata.subject}",
    "metadata": {
        "examBoard": "${metadata.examBoard}",
        "year": "${metadata.year}",
        "session": "${metadata.session}",
        "paperNumber": "${metadata.paperNumber}",
        "totalMarks": 100,
        "timeLimit": 90,
        "difficulty": "Intermediate"
    },
    "questions": [
        {
            "id": 1,
            "question": "Complete question text with proper formatting",
            "type": "multiple_choice|short_answer|calculation|essay",
            "marks": 2,
            "passage": "Full reading passage for comprehension questions (if applicable)",
            "highlightedSentences": [
                {
                    "sentence": "Key sentence students should focus on",
                    "reason": "Why this sentence is important for answering"
                }
            ],
            "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
            "correctAnswer": "B) Option 2",
            "explanation": "Detailed step-by-step explanation referencing the passage and mark scheme",
            "markingCriteria": [
                "1 mark for correct method",
                "1 mark for correct answer"
            ],
            "difficulty": "Easy|Medium|Hard",
            "topic": "Specific topic within subject",
            "learningObjective": "What students should demonstrate",
            "answerMode": "static|keywords|ai",
            "focusArea": "Specific part of passage or concept to concentrate on"
        }
    ],
    "instructions": "Clear exam instructions",
    "formulaeSheet": "Key formulae from insert sheet if provided",
    "tips": [
        "Important exam tips and strategies"
    ]
}

QUALITY REQUIREMENTS:
- Extract questions exactly as written, preserving numbering and formatting
- Create engaging reading passages that provide context for questions
- Highlight key sentences that students should focus on to answer correctly
- Ensure answers match the official mark scheme
- Provide comprehensive explanations referencing both passage and mark scheme
- Include relevant formulae and constants from insert sheet
- Maintain academic rigor and accuracy
- Support different question types appropriately
- Make passages substantial (200-400 words) for proper comprehension
- Ensure highlighted sentences directly relate to question answers

Generate the quiz now:`;

            const model = this.genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-lite' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse the JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in AI response');
            }

            const quizData = JSON.parse(jsonMatch[0]);

            // Validate and enhance the quiz data
            if (!quizData.questions || !Array.isArray(quizData.questions)) {
                throw new Error('Invalid quiz format: questions array required');
            }

            // Add additional metadata
            quizData.generatedAt = new Date();
            quizData.aiGenerated = true;
            quizData.sourceType = 'multi_pdf';
            quizData.questionCount = quizData.questions.length;

            // Calculate total marks
            quizData.metadata.totalMarks = quizData.questions.reduce((total: number, q: any) =>
                total + (q.marks || 1), 0);

            console.log(`✅ Generated quiz with ${quizData.questions.length} questions (${quizData.metadata.totalMarks} marks)`);
            return quizData;

        } catch (error) {
            console.error('❌ Error generating quiz from multiple PDFs:', error);
            throw new Error(`AI quiz generation failed: ${error.message}`);
        }
    }

    static async reviewAndEnhanceQuiz(quizData: any, userFeedback?: string): Promise<any> {
        try {
            console.log('🔍 Reviewing and enhancing quiz...');

            const prompt = `You are a senior education reviewer. Review and enhance this quiz:

CURRENT QUIZ:
${JSON.stringify(quizData, null, 2)}

${userFeedback ? `USER FEEDBACK:\n${userFeedback}\n\n` : ''}

REVIEW TASKS:
1. Check question clarity and accuracy
2. Verify answer correctness
3. Improve explanations if needed
4. Ensure proper mark allocation
5. Fix any formatting issues
6. Add missing learning objectives
7. Improve question difficulty balance

Return the enhanced quiz in the same JSON format with improvements applied.`;

            const model = this.genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash-lite' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in review response');
            }

            const enhancedQuiz = JSON.parse(jsonMatch[0]);
            enhancedQuiz.lastReviewed = new Date();
            enhancedQuiz.reviewCount = (quizData.reviewCount || 0) + 1;

            console.log('✅ Quiz reviewed and enhanced');
            return enhancedQuiz;

        } catch (error) {
            console.error('❌ Error reviewing quiz:', error);
            throw error;
        }
    }
}

module.exports = { AIService };
export { }; // Force TypeScript to treat this as a module