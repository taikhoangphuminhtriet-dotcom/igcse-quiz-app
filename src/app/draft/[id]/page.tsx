'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

interface Question {
    id: number | string;
    question: string;
    type: 'multiple_choice' | 'short_answer' | 'calculation' | 'essay';
    marks: number;
    passage?: string;
    highlightedSentences?: Array<{
        sentence: string;
        reason: string;
    }>;
    options?: string[];
    correctAnswer: string | number;
    explanation?: string;
    answerMode?: 'static' | 'keywords' | 'ai';
}

interface QuizDraft {
    id: string;
    title: string;
    subject: string;
    status: 'draft' | 'published';
    questions: Question[];
    metadata?: {
        examBoard?: string;
        year?: string;
        session?: string;
        timeLimit?: number;
        totalMarks?: number;
    };
    createdBy: string;
    createdAt: any;
    lastModified?: any;
    aiGenerated?: boolean;
    streamingSession?: string;
}

export default function DraftPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading } = useAuth();
    const [draft, setDraft] = useState<QuizDraft | null>(null);
    const [loadingDraft, setLoadingDraft] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const draftId = params?.id as string;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user && draftId) {
            fetchDraft();
        }
    }, [user, draftId]);

    // Auto-save functionality
    useEffect(() => {
        if (!autoSaveEnabled || !draft || draft.status === 'published') return;

        const saveTimer = setTimeout(() => {
            saveDraft(true);
        }, 5000); // Auto-save every 5 seconds if there are changes

        return () => clearTimeout(saveTimer);
    }, [draft, autoSaveEnabled]);

    const fetchDraft = async () => {
        setLoadingDraft(true);
        setError('');

        try {
            const docRef = doc(db, 'quizzes', draftId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as QuizDraft;
                
                // Check if user has permission to edit
                if (data.createdBy !== user?.uid && user?.role !== 'owner' && user?.role !== 'developer') {
                    setError('You do not have permission to edit this draft');
                    setLoadingDraft(false);
                    return;
                }

                setDraft({ ...data, id: draftId });
            } else {
                setError('Draft not found');
            }
        } catch (error) {
            console.error('Error fetching draft:', error);
            setError('Failed to load draft');
        } finally {
            setLoadingDraft(false);
        }
    };

    const saveDraft = async (isAutoSave = false) => {
        if (!draft) return;

        setSaving(true);
        setError('');

        try {
            const docRef = doc(db, 'quizzes', draftId);
            
            const updateData = {
                ...draft,
                lastModified: new Date(),
                modifiedBy: user?.uid
            };

            await updateDoc(docRef, updateData);
            
            setLastSaved(new Date());
            if (!isAutoSave) {
                setSuccess('Draft saved successfully!');
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            if (!isAutoSave) {
                setError('Failed to save draft');
            }
        } finally {
            setSaving(false);
        }
    };

    const publishQuiz = async () => {
        if (!draft) return;

        setPublishing(true);
        setError('');

        try {
            const token = await user?.getIdToken?.();
            
            const response = await fetch(`http://localhost:3001/api/publish-quiz/${draftId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success) {
                setDraft({ ...draft, status: 'published' });
                setSuccess('Quiz published successfully! Students can now take this quiz.');
                
                // Redirect to quizzes page after 2 seconds
                setTimeout(() => {
                    router.push('/quizzes');
                }, 2000);
            } else {
                setError(result.error || 'Failed to publish quiz');
            }
        } catch (error) {
            console.error('Error publishing quiz:', error);
            setError('Failed to publish quiz');
        } finally {
            setPublishing(false);
        }
    };

    const updateQuestion = (index: number, updates: Partial<Question>) => {
        if (!draft) return;

        const newQuestions = [...draft.questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        
        setDraft({
            ...draft,
            questions: newQuestions,
            metadata: {
                ...draft.metadata,
                totalMarks: newQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)
            }
        });
    };

    const deleteQuestion = (index: number) => {
        if (!draft) return;

        const newQuestions = draft.questions.filter((_, i) => i !== index);
        
        setDraft({
            ...draft,
            questions: newQuestions,
            metadata: {
                ...draft.metadata,
                totalMarks: newQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)
            }
        });
    };

    const addQuestion = () => {
        if (!draft) return;

        const newQuestion: Question = {
            id: `q${draft.questions.length + 1}`,
            question: '',
            type: 'multiple_choice',
            marks: 1,
            options: ['', '', '', ''],
            correctAnswer: 0,
            answerMode: 'static'
        };

        setDraft({
            ...draft,
            questions: [...draft.questions, newQuestion]
        });
        
        setEditingQuestion(draft.questions.length);
    };

    if (loading || loadingDraft) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading draft...</p>
                </div>
            </div>
        );
    }

    if (error && !draft) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => router.push('/upload/quiz-creator')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Create New Quiz
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {draft?.title || 'Untitled Quiz'}
                            </h1>
                            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    {draft?.status === 'draft' ? 'Draft' : 'Published'}
                                </span>
                                <span>Subject: {draft?.subject}</span>
                                {draft?.metadata?.totalMarks && (
                                    <span>Total Marks: {draft.metadata.totalMarks}</span>
                                )}
                                <span>{draft?.questions.length} Questions</span>
                            </div>
                            {lastSaved && (
                                <p className="mt-2 text-xs text-gray-500">
                                    Last saved: {lastSaved.toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                        
                        <div className="flex space-x-3">
                            <label className="flex items-center text-sm">
                                <input
                                    type="checkbox"
                                    checked={autoSaveEnabled}
                                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                                    className="mr-2"
                                />
                                Auto-save
                            </label>
                            
                            <button
                                onClick={() => saveDraft(false)}
                                disabled={saving || draft?.status === 'published'}
                                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Draft'}
                            </button>
                            
                            {draft?.status === 'draft' && (
                                <button
                                    onClick={publishQuiz}
                                    disabled={publishing || !draft?.questions.length}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                                >
                                    {publishing ? 'Publishing...' : 'Publish Quiz'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                            {success}
                        </div>
                    )}
                </div>

                {/* Quiz Metadata */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Quiz Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title
                            </label>
                            <input
                                type="text"
                                value={draft?.title || ''}
                                onChange={(e) => setDraft(draft ? { ...draft, title: e.target.value } : null)}
                                disabled={draft?.status === 'published'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subject
                            </label>
                            <select
                                value={draft?.subject || ''}
                                onChange={(e) => setDraft(draft ? { ...draft, subject: e.target.value } : null)}
                                disabled={draft?.status === 'published'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            >
                                <option value="">Select Subject</option>
                                {['Math', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'].map(subject => (
                                    <option key={subject} value={subject}>{subject}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Time Limit (minutes)
                            </label>
                            <input
                                type="number"
                                value={draft?.metadata?.timeLimit ? draft.metadata.timeLimit / 60 : 60}
                                onChange={(e) => setDraft(draft ? {
                                    ...draft,
                                    metadata: {
                                        ...draft.metadata,
                                        timeLimit: parseInt(e.target.value) * 60
                                    }
                                } : null)}
                                disabled={draft?.status === 'published'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
                        {draft?.status === 'draft' && (
                            <button
                                onClick={addQuestion}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Add Question
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {draft?.questions.map((question, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium text-gray-900">
                                        Question {index + 1} ({question.marks} marks)
                                    </h3>
                                    {draft.status === 'draft' && (
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => setEditingQuestion(editingQuestion === index ? null : index)}
                                                className="text-indigo-600 hover:text-indigo-700 text-sm"
                                            >
                                                {editingQuestion === index ? 'Done' : 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => deleteQuestion(index)}
                                                className="text-red-600 hover:text-red-700 text-sm"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editingQuestion === index ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={question.question}
                                            onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            rows={3}
                                            placeholder="Enter question text..."
                                        />
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <select
                                                value={question.type}
                                                onChange={(e) => updateQuestion(index, { type: e.target.value as Question['type'] })}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="multiple_choice">Multiple Choice</option>
                                                <option value="short_answer">Short Answer</option>
                                                <option value="calculation">Calculation</option>
                                                <option value="essay">Essay</option>
                                            </select>
                                            
                                            <input
                                                type="number"
                                                value={question.marks}
                                                onChange={(e) => updateQuestion(index, { marks: parseInt(e.target.value) })}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Marks"
                                            />
                                            
                                            <select
                                                value={question.answerMode || 'static'}
                                                onChange={(e) => updateQuestion(index, { answerMode: e.target.value as Question['answerMode'] })}
                                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="static">Static</option>
                                                <option value="keywords">Keywords</option>
                                                <option value="ai">AI</option>
                                            </select>
                                        </div>

                                        {question.type === 'multiple_choice' && (
                                            <div className="space-y-2">
                                                {question.options?.map((option, optIndex) => (
                                                    <div key={optIndex} className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            checked={question.correctAnswer === optIndex}
                                                            onChange={() => updateQuestion(index, { correctAnswer: optIndex })}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={option}
                                                            onChange={(e) => {
                                                                const newOptions = [...(question.options || [])];
                                                                newOptions[optIndex] = e.target.value;
                                                                updateQuestion(index, { options: newOptions });
                                                            }}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {question.type !== 'multiple_choice' && (
                                            <textarea
                                                value={question.correctAnswer as string}
                                                onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                rows={2}
                                                placeholder="Enter correct answer..."
                                            />
                                        )}

                                        <textarea
                                            value={question.explanation || ''}
                                            onChange={(e) => updateQuestion(index, { explanation: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            rows={2}
                                            placeholder="Enter explanation (optional)..."
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-gray-700 mb-2">{question.question}</p>
                                        {question.type === 'multiple_choice' && question.options && (
                                            <div className="space-y-1 mb-2">
                                                {question.options.map((option, optIndex) => (
                                                    <div key={optIndex} className={`text-sm ${question.correctAnswer === optIndex ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                                        {String.fromCharCode(65 + optIndex)}. {option}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {question.type !== 'multiple_choice' && (
                                            <p className="text-sm text-gray-600 mb-2">
                                                Answer: {question.correctAnswer}
                                            </p>
                                        )}
                                        {question.explanation && (
                                            <p className="text-sm text-gray-500 italic">
                                                Explanation: {question.explanation}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}