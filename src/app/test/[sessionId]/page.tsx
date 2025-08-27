'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';

interface Question {
    id: string;
    question: string;
    type: 'multiple_choice' | 'short_answer' | 'calculation' | 'essay';
    options?: string[];
    marks: number;
    passage?: string;
    highlightedSentences?: Array<{
        sentence: string;
        reason: string;
    }>;
}

interface TestSession {
    sessionId: string;
    quizId: string;
    quiz: {
        title: string;
        subject: string;
        questions: Question[];
        metadata?: {
            timeLimit?: number;
            totalMarks?: number;
        };
    };
    startTime: Date;
    timeRemaining: number;
    currentQuestion: number;
    answers: { [key: string]: any };
    status: 'active' | 'completed' | 'expired';
}

export default function TestPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading } = useAuth();
    const sessionId = params?.sessionId as string;

    const [testSession, setTestSession] = useState<TestSession | null>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<{ [key: string]: any }>({});
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user && sessionId) {
            loadTestSession();
        }
    }, [user, sessionId]);

    // Timer effect
    useEffect(() => {
        if (timeRemaining <= 0 || !testSession || testSession.status !== 'active') return;

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeRemaining, testSession]);

    const loadTestSession = async () => {
        setLoadingSession(true);
        
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch(`http://localhost:3001/api/test-session/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            const result = await response.json();

            if (result.success) {
                setTestSession(result.data);
                setTimeRemaining(result.data.timeRemaining);
                setCurrentQuestion(result.data.currentQuestion);
                setAnswers(result.data.answers || {});
                
                if (result.data.status === 'completed') {
                    setShowResults(true);
                    loadTestResults();
                }
            } else {
                console.error('Failed to load test session:', result.error);
                router.push('/quizzes');
            }
        } catch (error) {
            console.error('Error loading test session:', error);
            router.push('/quizzes');
        } finally {
            setLoadingSession(false);
        }
    };

    const loadTestResults = async () => {
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch(`http://localhost:3001/api/test-results/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            const result = await response.json();
            if (result.success) {
                setTestResult(result.data);
            }
        } catch (error) {
            console.error('Error loading test results:', error);
        }
    };

    const handleAnswerChange = async (questionId: string, answer: any) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));

        // Auto-save progress
        try {
            const token = await user?.getIdToken?.();
            await fetch(`http://localhost:3001/api/test-progress/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    questionId,
                    answer,
                    currentQuestion
                })
            });
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    };

    const handleTimeUp = async () => {
        console.log('⏰ Time is up! Submitting test...');
        await submitTest();
    };

    const submitTest = async () => {
        if (!testSession) return;

        setSubmitting(true);
        
        try {
            const token = await user?.getIdToken?.();
            
            const answersArray = testSession.quiz.questions.map((question, index) => ({
                questionId: index,
                answer: answers[question.id] || ''
            }));

            const response = await fetch(`http://localhost:3001/api/complete-test/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answers: answersArray }),
            });

            const result = await response.json();

            if (result.success) {
                setTestResult(result.data);
                setShowResults(true);
                console.log('🎉 Test completed successfully!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error submitting test:', error);
            alert('Failed to submit test. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading || loadingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading test session...</p>
                </div>
            </div>
        );
    }

    if (!testSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Test session not found</p>
                    <button
                        onClick={() => router.push('/quizzes')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Browse Quizzes
                    </button>
                </div>
            </div>
        );
    }

    if (showResults && testResult) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <h1 className="text-3xl font-bold text-center mb-8">Test Results</h1>
                        
                        <div className="text-center mb-8">
                            <div className="text-6xl font-bold mb-2">
                                {testResult.percentage.toFixed(1)}%
                            </div>
                            <div className={`text-2xl font-semibold ${testResult.status === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                                {testResult.status === 'pass' ? 'PASSED' : 'FAILED'}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-gray-600">Correct Answers</p>
                                <p className="text-2xl font-semibold">{testResult.correctAnswers} / {testResult.totalQuestions}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-gray-600">XP Earned</p>
                                <p className="text-2xl font-semibold text-indigo-600">+{testResult.xpEarned} XP</p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/quizzes')}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Back to Quizzes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!testSession.quiz || !testSession.quiz.questions) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Invalid test session data</p>
                    <button
                        onClick={() => router.push('/quizzes')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Browse Quizzes
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = testSession.quiz.questions[currentQuestion];

    if (!currentQ) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Question not found</p>
                    <button
                        onClick={() => router.push('/quizzes')}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Browse Quizzes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">{testSession.quiz.title}</h1>
                            <p className="text-sm text-gray-600">Question {currentQuestion + 1} of {testSession.quiz.questions.length}</p>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <div className={`text-lg font-semibold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                                ⏱️ {formatTime(timeRemaining)}
                            </div>
                            
                            <button
                                onClick={submitTest}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                {submitting ? 'Submitting...' : 'Submit Test'}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestion + 1) / testSession.quiz.questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow-sm p-8">
                    {/* Passage if exists */}
                    {currentQ.passage && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold text-gray-700 mb-2">Reading Passage:</h3>
                            <p className="text-gray-600 whitespace-pre-wrap">{currentQ.passage}</p>
                            
                            {currentQ.highlightedSentences && currentQ.highlightedSentences.length > 0 && (
                                <div className="mt-4 p-3 bg-yellow-50 rounded">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">Key Points:</p>
                                    {currentQ.highlightedSentences.map((hs, idx) => (
                                        <p key={idx} className="text-sm text-yellow-700">
                                            • {hs.sentence}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Question */}
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-1">
                            {currentQ.question}
                        </h2>
                        <p className="text-sm text-gray-500">({currentQ.marks} marks)</p>
                    </div>

                    {/* Answer Input */}
                    {currentQ.type === 'multiple_choice' && currentQ.options && (
                        <div className="space-y-3">
                            {currentQ.options.map((option, index) => (
                                <label key={index} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        name={`question-${currentQuestion}`}
                                        value={index}
                                        checked={answers[currentQ.id] === index}
                                        onChange={() => handleAnswerChange(currentQ.id, index)}
                                        className="mr-3"
                                    />
                                    <span className="text-gray-700">{option}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {currentQ.type !== 'multiple_choice' && (
                        <textarea
                            value={answers[currentQ.id] || ''}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={currentQ.type === 'essay' ? 8 : 4}
                            placeholder={`Enter your answer here... (${currentQ.type})`}
                        />
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-8">
                        <button
                            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                            disabled={currentQuestion === 0}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>

                        <div className="flex space-x-2">
                            {testSession.quiz.questions.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentQuestion(index)}
                                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                                        index === currentQuestion
                                            ? 'bg-indigo-600 text-white'
                                            : answers[testSession.quiz.questions[index].id]
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {index + 1}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentQuestion(Math.min(testSession.quiz.questions.length - 1, currentQuestion + 1))}
                            disabled={currentQuestion === testSession.quiz.questions.length - 1}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}