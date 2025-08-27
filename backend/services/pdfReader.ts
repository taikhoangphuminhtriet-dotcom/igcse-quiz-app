const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

class PDFReaderService {
    static async extractTextFromPDF(pdfPath: string): Promise<string> {
        try {
            console.log(`📖 Reading PDF: ${pdfPath}`);

            // Check if file exists
            if (!fs.existsSync(pdfPath)) {
                throw new Error(`PDF file not found: ${pdfPath}`);
            }

            // Read the PDF file
            const dataBuffer = fs.readFileSync(pdfPath);

            // Parse the PDF and extract text
            const data = await pdfParse(dataBuffer);

            // Clean and format the extracted text
            const cleanText = this.cleanExtractedText(data.text);

            console.log(`✅ Successfully extracted ${cleanText.length} characters from PDF`);
            return cleanText;

        } catch (error) {
            console.error('❌ Error reading PDF:', error);
            throw new Error(`Failed to read PDF: ${error.message}`);
        }
    }

    static async extractTextFromMultiplePDFs(pdfPaths: {
        insert: string;
        questions: string;
        markscheme: string;
    }): Promise<{
        insertText: string;
        questionsText: string;
        markschemeText: string;
    }> {
        try {
            console.log('📚 Processing multiple PDFs...');

            const result: any = {};

            // Extract text from all PDFs (ALL REQUIRED)
            result.insertText = await this.extractTextFromPDF(pdfPaths.insert);
            result.questionsText = await this.extractTextFromPDF(pdfPaths.questions);
            result.markschemeText = await this.extractTextFromPDF(pdfPaths.markscheme);

            console.log('✅ Successfully processed all PDFs');
            return result;

        } catch (error) {
            console.error('❌ Error processing multiple PDFs:', error);
            throw error;
        }
    }

    private static cleanExtractedText(text: string): string {
        // Remove excessive whitespace and normalize line breaks
        let cleaned = text.replace(/\s+/g, ' ').trim();

        // Fix common OCR issues
        cleaned = cleaned.replace(/\s+([.,:;!?])/g, '$1'); // Remove space before punctuation
        cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2'); // Add line breaks after sentences
        cleaned = cleaned.replace(/\n\s*\n/g, '\n\n'); // Normalize multiple line breaks

        // Fix question numbering patterns
        cleaned = cleaned.replace(/(\d+)\s*\.\s*/g, '\n\nQuestion $1. ');
        cleaned = cleaned.replace(/\bQ\s*(\d+)\b/gi, '\n\nQuestion $1');

        // Fix answer patterns
        cleaned = cleaned.replace(/\b([A-Z])\s*\)\s*/g, '\n$1) ');
        cleaned = cleaned.replace(/\b([A-Z])\s*\.\s*/g, '\n$1. ');

        // Remove page numbers and headers/footers
        cleaned = cleaned.replace(/Page\s+\d+/gi, '');
        cleaned = cleaned.replace(/\d+\s*\/\s*\d+/g, '');
        cleaned = cleaned.replace(/Cambridge\s+IGCSE|Edexcel\s+IGCSE/gi, '');

        return cleaned.trim();
    }

    static async analyzeQuestionStructure(questionsText: string): Promise<{
        questionCount: number;
        questionTypes: string[];
        subjects: string[];
        difficulty: string;
    }> {
        try {
            const questions = this.extractQuestions(questionsText);

            const analysis = {
                questionCount: questions.length,
                questionTypes: this.identifyQuestionTypes(questionsText),
                subjects: this.identifySubjects(questionsText),
                difficulty: this.assessDifficulty(questionsText)
            };

            console.log('📊 Question analysis:', analysis);
            return analysis;

        } catch (error) {
            console.error('❌ Error analyzing question structure:', error);
            throw error;
        }
    }

    private static extractQuestions(text: string): string[] {
        // Split by question numbers (common patterns)
        const questionPatterns = [
            /Question\s+\d+/gi,
            /\b\d+\s*\./g,
            /\bQ\s*\d+/gi
        ];

        let questions: string[] = [];

        for (const pattern of questionPatterns) {
            const matches = text.split(pattern);
            if (matches.length > questions.length) {
                questions = matches.filter(q => q.trim().length > 20); // Filter out short fragments
            }
        }

        return questions;
    }

    private static identifyQuestionTypes(text: string): string[] {
        const types: string[] = [];

        // Check for multiple choice
        if (/[A-E]\s*\)/g.test(text) || /[A-E]\s*\./g.test(text)) {
            types.push('Multiple Choice');
        }

        // Check for calculations
        if (/calculate|find|solve|work out/gi.test(text)) {
            types.push('Calculation');
        }

        // Check for explanations
        if (/explain|describe|discuss|give reasons/gi.test(text)) {
            types.push('Explanation');
        }

        // Check for diagrams
        if (/diagram|figure|graph|chart/gi.test(text)) {
            types.push('Diagram');
        }

        return types.length > 0 ? types : ['General'];
    }

    private static identifySubjects(text: string): string[] {
        const subjects: string[] = [];

        // Common subject keywords
        const subjectKeywords = {
            'Mathematics': ['equation', 'formula', 'calculate', 'solve', 'graph', 'algebra'],
            'Science': ['experiment', 'hypothesis', 'observation', 'reaction', 'element'],
            'Physics': ['force', 'energy', 'motion', 'electricity', 'wave'],
            'Chemistry': ['atom', 'molecule', 'reaction', 'compound', 'element'],
            'Biology': ['cell', 'organism', 'evolution', 'ecosystem', 'gene'],
            'English': ['analyze', 'character', 'theme', 'metaphor', 'literature'],
            'History': ['event', 'period', 'century', 'empire', 'war'],
            'Geography': ['climate', 'population', 'urban', 'river', 'mountain']
        };

        for (const [subject, keywords] of Object.entries(subjectKeywords)) {
            const keywordCount = keywords.filter(keyword =>
                new RegExp(keyword, 'gi').test(text)
            ).length;

            if (keywordCount >= 2) {
                subjects.push(subject);
            }
        }

        return subjects.length > 0 ? subjects : ['General'];
    }

    private static assessDifficulty(text: string): string {
        // Simple difficulty assessment based on complexity indicators
        const complexWords = ['analyze', 'evaluate', 'synthesize', 'compare', 'contrast'];
        const basicWords = ['identify', 'list', 'name', 'define', 'state'];

        const complexCount = complexWords.filter(word =>
            new RegExp(word, 'gi').test(text)
        ).length;

        const basicCount = basicWords.filter(word =>
            new RegExp(word, 'gi').test(text)
        ).length;

        if (complexCount > basicCount) {
            return 'Advanced';
        } else if (basicCount > complexCount * 2) {
            return 'Basic';
        } else {
            return 'Intermediate';
        }
    }
}

module.exports = { PDFReaderService };
export { }; // Force TypeScript to treat this as a module
