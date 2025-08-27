'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Question {
    id: string;
    type: 'multiple_choice' | 'short_answer' | 'essay';
    question: string;
    options?: string[];
    correctAnswer: string | number;
    marks: number;
    explanation?: string;
}

interface TestData {
    title: string;
    subject: string;
    description: string;
    timeLimit: number;
    totalMarks: number;
    instructions: string;
    questions: Question[];
}

export default function ManualTestCreator() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [testData, setTestData] = useState<TestData>({
        title: '',
        subject: '',
        description: '',
        timeLimit: 60,
        totalMarks: 0,
        instructions: '',
        questions: []
    });

    const [currentQuestion, setCurrentQuestion] = useState<Question>({
        id: '',
        type: 'multiple_choice',
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        marks: 1,
        explanation: ''
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState(-1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const subjects = ['Math', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'];

    useEffect(() => {
        if (!loading && (!user || (user.role !== 'developer' && user.role !== 'owner'))) {
            router.push('/dashboard');
        }
    }, [user, loading, router]);

    // Calculate total marks whenever questions change
    useEffect(() => {
        const total = testData.questions.reduce((sum, q) => sum + q.marks, 0);
        setTestData(prev => ({ ...prev, totalMarks: total }));
    }, [testData.questions]);

    const handleTestDataChange = (field: keyof TestData, value: string | number) => {
        setTestData(prev => ({ ...prev, [field]: value }));
    };

    const handleQuestionChange = (field: keyof Question, value: any) => {
        setCurrentQuestion(prev => ({ ...prev, [field]: value }));
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...(currentQuestion.options || ['', '', '', ''])];
        newOptions[index] = value;
        setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
    };

    const addQuestion = () => {
        if (!currentQuestion.question.trim()) {
            setError('Question text is required');
            return;
        }

        if (currentQuestion.type === 'multiple_choice') {
            const filledOptions = currentQuestion.options?.filter(opt => opt.trim()) || [];
            if (filledOptions.length < 2) {
                setError('Multiple choice questions need at least 2 options');
                return;
            }
        }

        const newQuestion: Question = {
            ...currentQuestion,
            id: `q${Date.now()}`,
        };

        if (isEditing) {
            const updatedQuestions = [...testData.questions];
            updatedQuestions[editingIndex] = newQuestion;
            setTestData(prev => ({ ...prev, questions: updatedQuestions }));
            setIsEditing(false);
            setEditingIndex(-1);
        } else {
            setTestData(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }));
        }

        // Reset form
        setCurrentQuestion({
            id: '',
            type: 'multiple_choice',
            question: '',
            options: ['', '', '', ''],
            correctAnswer: 0,
            marks: 1,
            explanation: ''
        });
        setError('');
    };

    const editQuestion = (index: number) => {
        const question = testData.questions[index];
        setCurrentQuestion(question);
        setIsEditing(true);
        setEditingIndex(index);
    };

    const deleteQuestion = (index: number) => {
        const updatedQuestions = testData.questions.filter((_, i) => i !== index);
        setTestData(prev => ({ ...prev, questions: updatedQuestions }));
    };

    const saveTest = async () => {
        if (!testData.title.trim() || !testData.subject || testData.questions.length === 0) {
            setError('Please fill in all required fields and add at least one question');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const token = await user?.getIdToken?.();
            const response = await fetch('http://localhost:3001/api/manual-test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...testData,
                    createdBy: user?.uid,
                    createdAt: new Date(),
                    status: 'published'
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess('Test created successfully!');
                // Reset form
                setTestData({
                    title: '',
                    subject: '',
                    description: '',
                    timeLimit: 60,
                    totalMarks: 0,
                    instructions: '',
                    questions: []
                });
            } else {
                setError(result.error || 'Failed to create test');
            }
        } catch (error) {
            console.error('Save error:', error);
            setError('Failed to save test. Please try again.');
        } finally {
            setSaving(false);
        }
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
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📝 Create Manual Test</h1>
                <p className="text-gray-600">
                    Build custom tests question by question with full control over content and scoring.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Test Info & Question Builder */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Test Information */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Test Title *
                                </label>
                                <input
                                    type="text"
                                    value={testData.title}
                                    onChange={(e) => handleTestDataChange('title', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Mathematics Mid-Term Test"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Subject *
                                </label>
                                <select
                                    value={testData.subject}
                                    onChange={(e) => handleTestDataChange('subject', e.target.value)}
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
                                    Time Limit (minutes)
                                </label>
                                <input
                                    type="number"
                                    value={testData.timeLimit}
                                    onChange={(e) => handleTestDataChange('timeLimit', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Total Marks
                                </label>
                                <input
                                    type="number"
                                    value={testData.totalMarks}
                                    readOnly
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={testData.description}
                                onChange={(e) => handleTestDataChange('description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="Brief description of the test..."
                            />
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Instructions
                            </label>
                            <textarea
                                value={testData.instructions}
                                onChange={(e) => handleTestDataChange('instructions', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="Instructions for students taking the test..."
                            />
                        </div>
                    </div>

                    {/* Question Builder */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            {isEditing ? 'Edit Question' : 'Add Question'}
                        </h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Question Type
                                    </label>
                                    <select
                                        value={currentQuestion.type}
                                        onChange={(e) => handleQuestionChange('type', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="multiple_choice">Multiple Choice</option>
                                        <option value="short_answer">Short Answer</option>
                                        <option value="essay">Essay</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Marks
                                    </label>
                                    <input
                                        type="number"
                                        value={currentQuestion.marks}
                                        onChange={(e) => handleQuestionChange('marks', parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                        min="1"
                                        max="20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Question Text *
                                </label>
                                <textarea
                                    value={currentQuestion.question}
                                    onChange={(e) => handleQuestionChange('question', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    rows={3}
                                    placeholder="Enter your question..."
                                />
                            </div>

                            {currentQuestion.type === 'multiple_choice' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Answer Options
                                    </label>
                                    <div className="space-y-2">
                                        {currentQuestion.options?.map((option, index) => (
                                            <div key={index} className="flex items-center space-x-2">
                                                <span className="text-sm font-medium text-gray-500 w-8">
                                                    {String.fromCharCode(65 + index)}.
                                                </span>
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                                />
                                                <input
                                                    type="radio"
                                                    name="correctAnswer"
                                                    checked={currentQuestion.correctAnswer === index}
                                                    onChange={() => handleQuestionChange('correctAnswer', index)}
                                                    className="text-indigo-600"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentQuestion.type !== 'multiple_choice' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Correct Answer
                                    </label>
                                    <textarea
                                        value={currentQuestion.correctAnswer as string}
                                        onChange={(e) => handleQuestionChange('correctAnswer', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                        rows={2}
                                        placeholder="Enter the correct answer..."
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Explanation (Optional)
                                </label>
                                <textarea
                                    value={currentQuestion.explanation}
                                    onChange={(e) => handleQuestionChange('explanation', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    rows={2}
                                    placeholder="Explanation for the correct answer..."
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex space-x-3">
                            <button
                                type="button"
                                onClick={addQuestion}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
                            >
                                {isEditing ? 'Update Question' : 'Add Question'}
                            </button>

                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditingIndex(-1);
                                        setCurrentQuestion({
                                            id: '',
                                            type: 'multiple_choice',
                                            question: '',
                                            options: ['', '', '', ''],
                                            correctAnswer: 0,
                                            marks: 1,
                                            explanation: ''
                                        });
                                    }}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Questions List */}
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Questions ({testData.questions.length})
                        </h2>

                        {testData.questions.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">
                                No questions added yet
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {testData.questions.map((question, index) => (
                                    <div key={question.id} className="border border-gray-200 rounded-lg p-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="text-sm font-medium text-gray-500">
                                                        Q{index + 1}
                                                    </span>
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                        {question.type.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                                        {question.marks} marks
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-900 line-clamp-2">
                                                    {question.question}
                                                </p>
                                            </div>
                                            <div className="flex space-x-1 ml-2">
                                                <button
                                                    onClick={() => editQuestion(index)}
                                                    className="text-indigo-600 hover:text-indigo-700 text-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteQuestion(index)}
                                                    className="text-red-600 hover:text-red-700 text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Save Test */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                                {success}
                            </div>
                        )}

                        <button
                            onClick={saveTest}
                            disabled={saving || testData.questions.length === 0}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving Test...
                                </>
                            ) : (
                                'Save & Publish Test'
                            )}
                        </button>

                        <div className="mt-4 text-sm text-gray-500 text-center">
                            <p>Total: {testData.questions.length} questions, {testData.totalMarks} marks</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}