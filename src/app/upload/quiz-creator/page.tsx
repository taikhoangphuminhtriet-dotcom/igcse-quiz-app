'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UploadedFile {
    file: File;
    type: 'insert' | 'questions' | 'markscheme';
    preview: string;
}

interface Question {
    id: number;
    question: string;
    type: 'multiple_choice' | 'short_answer' | 'calculation' | 'essay';
    marks: number;
    options?: string[];
    correctAnswer: string | number;
    explanation: string;
    markingCriteria?: string[];
    difficulty: 'Easy' | 'Medium' | 'Hard';
    topic: string;
    learningObjective: string;
    answerMode?: 'static' | 'ai' | 'keywords'; // New answer checking modes
    keywordVariations?: string[]; // For flexible answer variations
}

interface GeneratedQuiz {
    title: string;
    subject: string;
    metadata: {
        examBoard: string;
        year: string;
        session: string;
        paperNumber: string;
        totalMarks: number;
        timeLimit: number;
        difficulty: string;
    };
    questions: Question[];
    instructions: string;
    formulaeSheet: string;
    tips: string[];
    quizId?: string;
    pdfUrls?: {
        insert: string;
        questions: string;
        markscheme: string;
    };
}

export default function QuizCreatorPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [uploadData, setUploadData] = useState({
        title: '',
        subject: '',
        examBoard: '',
        year: '',
        session: '',
        paperNumber: '',
        customInstructions: '', // New field for custom AI instructions
    });

    const [files, setFiles] = useState<{
        insert?: UploadedFile;
        questions?: UploadedFile;
        markscheme?: UploadedFile;
    }>({});

    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState<'upload' | 'review' | 'edit'>('upload');
    const [generatedQuiz, setGeneratedQuiz] = useState<GeneratedQuiz | null>(null);
    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
    const [showAllQuestions, setShowAllQuestions] = useState(false);
    const [streamingStatus, setStreamingStatus] = useState('');
    const [streamingProgress, setStreamingProgress] = useState(0);
    const [streamingQuestions, setStreamingQuestions] = useState<any[]>([]);
    const [useStreaming, setUseStreaming] = useState(true);

    const subjects = ['Math', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'];
    const examBoards = ['Cambridge IGCSE', 'Edexcel IGCSE', 'AQA GCSE', 'OCR GCSE'];
    const sessions = ['March', 'June', 'November'];
    const answerModes = ['static', 'ai', 'keywords'];

    useEffect(() => {
        if (!loading && (!user || (user.role !== 'developer' && user.role !== 'owner'))) {
            router.push('/upload');
        }
    }, [user, loading, router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setUploadData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleFileUpload = (type: 'insert' | 'questions' | 'markscheme') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                setError(`Please select a PDF file for ${type}`);
                return;
            }
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                setError('File size must be less than 50MB');
                return;
            }

            setFiles(prev => ({
                ...prev,
                [type]: {
                    file,
                    type,
                    preview: file.name
                }
            }));
            setError('');
        }
    };

    const removeFile = (type: 'insert' | 'questions' | 'markscheme') => {
        setFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[type];
            return newFiles;
        });
    };

    const generateQuizWithStreaming = async () => {
        if (!files.insert || !files.questions || !files.markscheme) {
            setError('All 3 PDFs are required: Insert Sheet, Questions Paper, and Mark Scheme');
            return;
        }

        setProcessing(true);
        setError('');
        setSuccess('');
        setStreamingStatus('Connecting...');
        setStreamingProgress(0);
        setStreamingQuestions([]);

        try {
            const formData = new FormData();
            
            // Add files
            formData.append('insert', files.insert.file);
            formData.append('questions', files.questions.file);
            formData.append('markscheme', files.markscheme.file);

            // Add metadata
            Object.entries(uploadData).forEach(([key, value]) => {
                formData.append(key, value);
            });

            const token = await user?.getIdToken?.();
            
            // Use EventSource for SSE
            const response = await fetch('http://localhost:3001/api/generate-quiz-streaming', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to start streaming');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            switch (data.type) {
                                case 'status':
                                    setStreamingStatus(data.data);
                                    break;
                                case 'progress':
                                    setStreamingProgress(data.data);
                                    break;
                                case 'question':
                                    setStreamingQuestions(prev => [...prev, data.data.question]);
                                    setStreamingStatus(`Generated question ${data.data.questionNumber}`);
                                    break;
                                case 'complete':
                                    setStreamingStatus('Quiz generation complete!');
                                    setStreamingProgress(100);
                                    // Fetch the complete quiz
                                    await fetchGeneratedQuiz(data.data.quizId);
                                    break;
                                case 'error':
                                    setError(data.data);
                                    break;
                                case 'success':
                                    setSuccess(`Successfully generated quiz with ${data.data.questionCount} questions!`);
                                    setStep('review');
                                    break;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming generation error:', error);
            setError('Failed to generate quiz. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const fetchGeneratedQuiz = async (quizId: string) => {
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch(`http://localhost:3001/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                setGeneratedQuiz(result.data);
            }
        } catch (error) {
            console.error('Error fetching generated quiz:', error);
        }
    };

    const generateQuiz = async () => {
        if (useStreaming) {
            return generateQuizWithStreaming();
        }

        if (!files.insert || !files.questions || !files.markscheme) {
            setError('All 3 PDFs are required: Insert Sheet, Questions Paper, and Mark Scheme');
            return;
        }

        setProcessing(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();

            // Add files (all required now)
            formData.append('insert', files.insert.file);
            formData.append('questions', files.questions.file);
            formData.append('markscheme', files.markscheme.file);

            // Add metadata
            Object.entries(uploadData).forEach(([key, value]) => {
                formData.append(key, value);
            });

            const token = await user?.getIdToken?.();
            const response = await fetch('http://localhost:3001/api/generate-quiz-from-pdfs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                setGeneratedQuiz(result.data);
                setStep('review');
                setSuccess(`Successfully generated quiz with ${result.data.questions.length} questions!`);
            } else {
                setError(result.error || 'Failed to generate quiz');
            }
        } catch (error) {
            console.error('Quiz generation error:', error);
            setError('Failed to generate quiz. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const saveQuiz = async () => {
        if (!generatedQuiz) return;

        try {
            const token = await user?.getIdToken?.();
            const response = await fetch('http://localhost:3001/api/save-generated-quiz', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(generatedQuiz),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess('Quiz saved successfully!');
                router.push(`/quiz/${result.data.quizId}`);
            } else {
                setError(result.error || 'Failed to save quiz');
            }
        } catch (error) {
            console.error('Save error:', error);
            setError('Failed to save quiz. Please try again.');
        }
    };

    const updateQuestion = (index: number, updatedQuestion: Partial<Question>) => {
        if (!generatedQuiz) return;

        const updatedQuestions = [...generatedQuiz.questions];
        updatedQuestions[index] = { ...updatedQuestions[index], ...updatedQuestion };

        setGeneratedQuiz({
            ...generatedQuiz,
            questions: updatedQuestions
        });
    };

    const deleteQuestion = (index: number) => {
        if (!generatedQuiz) return;

        const updatedQuestions = generatedQuiz.questions.filter((_, i) => i !== index);

        setGeneratedQuiz({
            ...generatedQuiz,
            questions: updatedQuestions
        });
    };

    const addNewQuestion = () => {
        if (!generatedQuiz) return;

        const newQuestion: Question = {
            id: generatedQuiz.questions.length + 1,
            question: '',
            type: 'multiple_choice',
            marks: 1,
            correctAnswer: '',
            explanation: '',
            difficulty: 'Medium',
            topic: '',
            learningObjective: '',
            answerMode: 'static'
        };

        setGeneratedQuiz({
            ...generatedQuiz,
            questions: [...generatedQuiz.questions, newQuestion]
        });

        setEditingQuestion(generatedQuiz.questions.length);
    };

    // Parse answer syntax for flexible modes
    const parseAnswerSyntax = (answer: string) => {
        // Static mode: !static! answer
        const staticMatch = answer.match(/!static!\s*(.+)/);
        if (staticMatch) {
            return { mode: 'static', content: staticMatch[1].trim() };
        }

        // Keywords mode: !keywords! word1 | word2 | word3
        const keywordsMatch = answer.match(/!keywords!\s*(.+)/);
        if (keywordsMatch) {
            const keywords = keywordsMatch[1].split('|').map(k => k.trim());
            return { mode: 'keywords', content: keywords };
        }

        // AI mode: !ai! reference text for AI to judge
        const aiMatch = answer.match(/!ai!\s*(.+)/);
        if (aiMatch) {
            return { mode: 'ai', content: aiMatch[1].trim() };
        }

        // Default to static if no syntax
        return { mode: 'static', content: answer };
    };

    // Parse flexible syntax %...%
    const parseFlexibleSyntax = (text: string) => {
        // %s% for plurals
        text = text.replace(/(\w+)%s%/g, '$1 (accept singular/plural)');

        // %form-w% for word forms
        text = text.replace(/(\w+)%form-w%/g, '$1 (accept all word forms)');

        // %form-t% for tense forms
        text = text.replace(/(\w+)%form-t%/g, '$1 (accept all tense forms)');

        return text;
    };

    const FileUploadCard = ({
        type,
        title,
        description,
        required = false
    }: {
        type: 'insert' | 'questions' | 'markscheme';
        title: string;
        description: string;
        required?: boolean;
    }) => {
        const uploadedFile = files[type];

        return (
            <div className={`border-2 border-dashed rounded-lg p-6 transition-colors ${uploadedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-indigo-400'
                }`}>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                        {uploadedFile ? (
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {title}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">{description}</p>

                    {uploadedFile ? (
                        <div className="space-y-3">
                            <div className="bg-white rounded-md p-3 border">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                        {uploadedFile.preview}
                                    </span>
                                    <button
                                        onClick={() => removeFile(type)}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => removeFile(type)}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Replace file
                            </button>
                        </div>
                    ) : (
                        <div>
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileUpload(type)}
                                    className="hidden"
                                />
                                <div className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-block">
                                    Choose PDF File
                                </div>
                            </label>
                            <p className="text-xs text-gray-500 mt-2">PDF up to 50MB</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user || (user.role !== 'developer' && user.role !== 'owner')) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Quiz Creator</h1>
                        <p className="text-gray-600">
                            Upload 3 PDFs and let AI generate a comprehensive interactive quiz with advanced answer checking
                        </p>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                        <div className={`px-3 py-1 rounded-full ${step === 'upload' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'}`}>
                            1. Upload
                        </div>
                        <div className={`px-3 py-1 rounded-full ${step === 'review' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'}`}>
                            2. Review
                        </div>
                        <div className={`px-3 py-1 rounded-full ${step === 'edit' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'}`}>
                            3. Edit
                        </div>
                    </div>
                </div>
            </div>

            {step === 'upload' && (
                <div className="space-y-8">
                    {/* Paper Information */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">Paper Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paper Title *
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={uploadData.title}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Mathematics Paper 1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Subject *
                                </label>
                                <select
                                    name="subject"
                                    value={uploadData.subject}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map(subject => (
                                        <option key={subject} value={subject}>{subject}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Exam Board
                                </label>
                                <select
                                    name="examBoard"
                                    value={uploadData.examBoard}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Select Exam Board</option>
                                    {examBoards.map(board => (
                                        <option key={board} value={board}>{board}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Year
                                </label>
                                <input
                                    type="text"
                                    name="year"
                                    value={uploadData.year}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., 2023"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Session
                                </label>
                                <select
                                    name="session"
                                    value={uploadData.session}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Select Session</option>
                                    {sessions.map(session => (
                                        <option key={session} value={session}>{session}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paper Number
                                </label>
                                <input
                                    type="text"
                                    name="paperNumber"
                                    value={uploadData.paperNumber}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Paper 1"
                                />
                            </div>
                        </div>

                        {/* Custom AI Instructions */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Custom Instructions for AI (Optional)
                            </label>
                            <textarea
                                name="customInstructions"
                                value={uploadData.customInstructions}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="e.g., 'Focus only on reading comprehension questions, exclude writing tasks', 'Include only multiple choice questions', etc."
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Provide specific instructions to guide the AI in generating questions according to your preferences
                            </p>
                        </div>
                    </div>

                    {/* File Uploads */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <FileUploadCard
                            type="insert"
                            title="Insert Sheet"
                            description="Contains formulae, constants, and reference materials"
                            required
                        />

                        <FileUploadCard
                            type="questions"
                            title="Question Paper"
                            description="The main exam questions and instructions"
                            required
                        />

                        <FileUploadCard
                            type="markscheme"
                            title="Mark Scheme"
                            description="Answer key with marking criteria and explanations"
                            required
                        />
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                            {success}
                        </div>
                    )}

                    {/* Generate Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={generateQuiz}
                            disabled={processing || !files.insert || !files.questions || !files.markscheme || !uploadData.title || !uploadData.subject}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center text-lg"
                        >
                            {processing ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating Quiz... (This may take 2-3 minutes)
                                </>
                            ) : (
                                'Generate Quiz with AI 🤖'
                            )}
                        </button>
                    </div>

                    {/* Streaming toggle */}
                    <div className="mt-4 flex justify-center">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useStreaming}
                                onChange={(e) => setUseStreaming(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-600">
                                Use real-time streaming (see AI progress)
                            </span>
                        </label>
                    </div>

                    {/* Streaming Progress */}
                    {processing && useStreaming && (
                        <div className="mt-6 bg-gray-50 rounded-lg p-4">
                            <div className="mb-2">
                                <div className="flex justify-between text-sm text-gray-600 mb-1">
                                    <span>{streamingStatus}</span>
                                    <span>{streamingProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${streamingProgress}%` }}
                                    />
                                </div>
                            </div>

                            {streamingQuestions.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        Questions Generated: {streamingQuestions.length}
                                    </h4>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {streamingQuestions.map((q, idx) => (
                                            <div key={idx} className="text-xs text-gray-600 bg-white p-2 rounded">
                                                Q{idx + 1}: {q.question?.substring(0, 100)}...
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {step === 'review' && generatedQuiz && (
                <div className="space-y-6">
                    {/* Quiz Overview */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">Generated Quiz Review</h2>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Back to Upload
                                </button>
                                <button
                                    onClick={() => setStep('edit')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Edit Quiz
                                </button>
                                <button
                                    onClick={saveQuiz}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Save & Publish
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">{generatedQuiz.questions?.length || 0}</div>
                                <div className="text-sm text-blue-600">Questions</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">{generatedQuiz.metadata?.totalMarks || 0}</div>
                                <div className="text-sm text-green-600">Total Marks</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-purple-600">{generatedQuiz.metadata?.timeLimit || 60}</div>
                                <div className="text-sm text-purple-600">Minutes</div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-orange-600">{generatedQuiz.metadata?.difficulty || 'Mixed'}</div>
                                <div className="text-sm text-orange-600">Difficulty</div>
                            </div>
                        </div>

                        {/* Question List */}
                        <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">All Questions:</h3>
                                <button
                                    onClick={() => setShowAllQuestions(!showAllQuestions)}
                                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                >
                                    {showAllQuestions ? 'Show Less' : `Show All ${generatedQuiz.questions?.length || 0} Questions`}
                                </button>
                            </div>

                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {(showAllQuestions ? generatedQuiz.questions : generatedQuiz.questions?.slice(0, 3))?.map((question: Question, index: number) => (
                                    <div key={index} className="border-l-4 border-indigo-400 pl-4 py-3 bg-gray-50 rounded-r">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <span className="font-medium text-gray-900">Q{index + 1}.</span>
                                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{question.type}</span>
                                                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">{question.marks} marks</span>
                                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{question.difficulty}</span>
                                                </div>
                                                <div className="font-medium text-gray-900 mb-2">{question.question}</div>

                                                {question.options && (
                                                    <div className="mb-2 space-y-1">
                                                        {question.options.map((option: string, optIndex: number) => (
                                                            <div key={optIndex} className="text-sm text-gray-600">
                                                                {String.fromCharCode(65 + optIndex)}. {option}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="text-sm text-green-600 mb-1">
                                                    <strong>Answer:</strong> {question.correctAnswer}
                                                </div>

                                                {question.explanation && (
                                                    <div className="text-sm text-gray-600">
                                                        <strong>Explanation:</strong> {question.explanation}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setEditingQuestion(index);
                                                    setStep('edit');
                                                }}
                                                className="ml-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {!showAllQuestions && generatedQuiz.questions?.length > 3 && (
                                    <button
                                        onClick={() => setShowAllQuestions(true)}
                                        className="w-full text-center text-indigo-600 hover:text-indigo-700 text-sm font-medium py-2 border-2 border-dashed border-indigo-200 rounded-lg hover:border-indigo-400"
                                    >
                                        Click to view {generatedQuiz.questions.length - 3} more questions
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 'edit' && generatedQuiz && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">Edit Quiz Questions</h2>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setStep('review')}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Back to Review
                                </button>
                                <button
                                    onClick={addNewQuestion}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Add New Question
                                </button>
                                <button
                                    onClick={saveQuiz}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Save Quiz
                                </button>
                            </div>
                        </div>

                        {/* Question Editor */}
                        <div className="space-y-4">
                            {generatedQuiz.questions.map((question, index) => (
                                <div key={index} className={`border rounded-lg p-4 ${editingQuestion === index ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                    {editingQuestion === index ? (
                                        // Edit Mode
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-medium text-gray-900">Editing Question {index + 1}</h3>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => setEditingQuestion(null)}
                                                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => deleteQuestion(index)}
                                                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                                                    <select
                                                        value={question.type}
                                                        onChange={(e) => updateQuestion(index, { type: e.target.value as any })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    >
                                                        <option value="multiple_choice">Multiple Choice</option>
                                                        <option value="short_answer">Short Answer</option>
                                                        <option value="calculation">Calculation</option>
                                                        <option value="essay">Essay</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer Mode</label>
                                                    <select
                                                        value={question.answerMode || 'static'}
                                                        onChange={(e) => updateQuestion(index, { answerMode: e.target.value as any })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    >
                                                        <option value="static">Static (Exact Match)</option>
                                                        <option value="keywords">Keywords (Flexible)</option>
                                                        <option value="ai">AI Checking</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                                                    <input
                                                        type="number"
                                                        value={question.marks}
                                                        onChange={(e) => updateQuestion(index, { marks: parseInt(e.target.value) })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        min="1"
                                                        max="20"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                                                    <select
                                                        value={question.difficulty}
                                                        onChange={(e) => updateQuestion(index, { difficulty: e.target.value as any })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    >
                                                        <option value="Easy">Easy</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="Hard">Hard</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                                                <textarea
                                                    value={question.question}
                                                    onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    rows={3}
                                                />
                                            </div>

                                            {question.type === 'multiple_choice' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                                                    {question.options?.map((option, optIndex) => (
                                                        <div key={optIndex} className="flex items-center space-x-2 mb-2">
                                                            <span className="text-sm font-medium text-gray-500">{String.fromCharCode(65 + optIndex)}.</span>
                                                            <input
                                                                type="text"
                                                                value={option}
                                                                onChange={(e) => {
                                                                    const newOptions = [...(question.options || [])];
                                                                    newOptions[optIndex] = e.target.value;
                                                                    updateQuestion(index, { options: newOptions });
                                                                }}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                                            />
                                                            <input
                                                                type="radio"
                                                                name={`correct-${index}`}
                                                                checked={question.correctAnswer === optIndex}
                                                                onChange={() => updateQuestion(index, { correctAnswer: optIndex })}
                                                                className="text-indigo-600"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {question.type !== 'multiple_choice' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Correct Answer
                                                        {question.answerMode !== 'static' && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                (Use syntax: !{question.answerMode}! content)
                                                            </span>
                                                        )}
                                                    </label>
                                                    <textarea
                                                        value={question.correctAnswer as string}
                                                        onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        rows={2}
                                                        placeholder={
                                                            question.answerMode === 'keywords' ? 'e.g., !keywords! word1 | word2 | word3' :
                                                                question.answerMode === 'ai' ? 'e.g., !ai! Reference text for AI to compare against' :
                                                                    'Enter the exact correct answer'
                                                        }
                                                    />

                                                    {question.answerMode === 'keywords' && (
                                                        <div className="mt-2 text-xs text-gray-600">
                                                            <p><strong>Flexible syntax:</strong></p>
                                                            <p>• word%s% - accepts singular/plural</p>
                                                            <p>• word%form-w% - accepts all word forms</p>
                                                            <p>• word%form-t% - accepts all tenses</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                                                <textarea
                                                    value={question.explanation}
                                                    onChange={(e) => updateQuestion(index, { explanation: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        // View Mode
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <span className="font-medium text-gray-900">Q{index + 1}.</span>
                                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{question.type}</span>
                                                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">{question.marks} marks</span>
                                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{question.difficulty}</span>
                                                    {question.answerMode && question.answerMode !== 'static' && (
                                                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">{question.answerMode}</span>
                                                    )}
                                                </div>
                                                <div className="text-gray-900 mb-1">{question.question}</div>
                                                <div className="text-sm text-green-600">Answer: {question.correctAnswer}</div>
                                            </div>
                                            <button
                                                onClick={() => setEditingQuestion(index)}
                                                className="ml-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}