'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';

interface QuizData {
    id: string;
    title: string;
    subject: string;
    timeLimit: number;
    questions: Question[];
    instructions?: string;
    formulaeSheet?: string;
}

interface Question {
    id: number;
    question: string;
    type: 'multiple_choice' | 'short_answer' | 'calculation' | 'essay';
    options?: string[];
    correctAnswer: string | number;
    marks: number;
    passage?: string;
    highlightedSentences?: Array<{
        sentence: string;
        reason: string;
    }>;
    focusArea?: string;
    answerMode?: 'static' | 'keywords' | 'ai';
}

export default function QuizPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    // Test session state
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [testSessionId, setTestSessionId] = useState<string>('');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | number>>({});
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    // UI state
    const [loadingQuiz, setLoadingQuiz] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [showPassage, setShowPassage] = useState(true);
    const [highlightedSentence, setHighlightedSentence] = useState<string>('');

    // Prevent user from leaving
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!showResults && testSessionId) {
                e.preventDefault();
                e.returnValue = 'Your test is in progress. If you leave, your timer will continue running.';
                return 'Your test is in progress. If you leave, your timer will continue running.';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [showResults, testSessionId]);

    // Timer
    useEffect(() => {
        if (timeRemaining > 0 && !showResults) {
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
        }
    }, [timeRemaining, showResults]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user && quizId) {
            initializeTest();
        }
    }, [user, quizId]);

    const initializeTest = async () => {
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch(`http://localhost:3001/api/start-test/${quizId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                setQuiz(result.data.quiz);
                setTestSessionId(result.data.testSessionId);
                setTimeRemaining(result.data.timeLimit);

                if (result.data.resuming) {
                    setTimeRemaining(result.data.timeRemaining);
                    setCurrentQuestion(result.data.currentQuestion);
                    console.log('📖 Resuming test session...');
                } else {
                    console.log('🚀 Started new test session');
                }
            } else {
                alert(result.error);
                router.push('/quizzes');
            }
        } catch (error) {
            console.error('Error starting test:', error);
            router.push('/quizzes');
        } finally {
            setLoadingQuiz(false);
        }
    };

    const handleAnswerChange = async (questionId: string, answer: string | number) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer,
        }));

        // Auto-save progress
        if (testSessionId) {
            try {
                const token = await user?.getIdToken?.();
                await fetch(`http://localhost:3001/api/test-progress/${testSessionId}`, {
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
        }
    };

    const handleNextQuestion = () => {
        if (quiz && currentQuestion < quiz.questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            updateHighlightedSentence(currentQuestion + 1);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
            updateHighlightedSentence(currentQuestion - 1);
        }
    };

    const updateHighlightedSentence = (questionIndex: number) => {
        if (quiz && quiz.questions[questionIndex]?.highlightedSentences?.length) {
            setHighlightedSentence(quiz.questions[questionIndex].highlightedSentences![0].sentence);
        } else {
            setHighlightedSentence('');
        }
    };

    const handleTimeUp = async () => {
        alert('⏰ Time is up! Your test will be automatically submitted.');
        await submitQuiz();
    };

    const submitQuiz = async () => {
        if (!quiz || !testSessionId) return;

        setSubmitting(true);
        try {
            const token = await user?.getIdToken?.();

            // Prepare answers array
            const answersArray = quiz.questions.map((question, index) => ({
                questionId: index,
                answer: answers[question.id] || ''
            }));

            const response = await fetch(`http://localhost:3001/api/complete-test/${testSessionId}`, {
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
            console.error('Error submitting quiz:', error);
            alert('Failed to submit quiz. Please try again.');
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

    const highlightPassageText = (text: string, highlightSentence: string): string => {
        if (!highlightSentence) return text;

        return text.replace(
            new RegExp(highlightSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            `<mark class="bg-yellow-200 font-semibold">$&</mark>`
        );
    };

    if (loading || loadingQuiz) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Quiz not found</h1>
                    <button
                        onClick={() => router.push('/quizzes')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
                    >
                        Back to Quizzes
                    </button>
                </div>
            </div>
        );
    }

    if (showResults && testResult) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <div className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-bold mb-4 ${testResult.status === 'pass'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                            {testResult.status === 'pass' ? '🎉 PASSED!' : '😔 FAILED'}
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Results</h1>
                        <p className="text-gray-600">{quiz.title}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-blue-50 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-blue-600 mb-2">
                                {testResult.correctAnswers}/{testResult.totalQuestions}
                            </div>
                            <div className="text-sm text-blue-600">Correct Answers</div>
                        </div>

                        <div className="bg-green-50 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-green-600 mb-2">
                                {Math.round(testResult.score)}%
                            </div>
                            <div className="text-sm text-green-600">Score</div>
                        </div>

                        <div className="bg-purple-50 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-purple-600 mb-2">
                                +{testResult.xpEarned}
                            </div>
                            <div className="text-sm text-purple-600">XP Earned</div>
                        </div>

                        <div className="bg-orange-50 p-6 rounded-lg text-center">
                            <div className="text-3xl font-bold text-orange-600 mb-2">
                                {formatTime(testResult.timeSpent)}
                            </div>
                            <div className="text-sm text-orange-600">Time Spent</div>
                        </div>
                    </div>

                    {testResult.combos > 1 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <span className="text-2xl mr-2">🔥</span>
                                <div>
                                    <div className="font-semibold text-yellow-800">Combo Bonus!</div>
                                    <div className="text-yellow-700">You got {testResult.combos} correct answers in a row!</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {testResult.perfectScore && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <span className="text-2xl mr-2">✨</span>
                                <div>
                                    <div className="font-semibold text-purple-800">Perfect Score!</div>
                                    <div className="text-purple-700">You answered every question correctly!</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex space-x-4 justify-center">
                        <button
                            onClick={() => router.push('/quizzes')}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            Back to Quizzes
                        </button>
                        <button
                            onClick={() => router.push('/test-history')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            View History
                        </button>
                        {testResult.status === 'fail' && (
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium"
                            >
                                Retry Test
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const currentQ = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header with timer and progress */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{quiz.title}</h1>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
                            <span>•</span>
                            <span>{currentQ.marks} marks</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className={`text-lg font-mono ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                            ⏱️ {formatTime(timeRemaining)}
                        </div>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Passage (if available) */}
                {currentQ.passage && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Reading Passage</h2>
                            <button
                                onClick={() => setShowPassage(!showPassage)}
                                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                            >
                                {showPassage ? 'Hide' : 'Show'} Passage
                            </button>
                        </div>

                        {showPassage && (
                            <div className="space-y-4">
                                <div
                                    className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: highlightPassageText(currentQ.passage, highlightedSentence)
                                    }}
                                />

                                {currentQ.highlightedSentences && currentQ.highlightedSentences.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                        <h3 className="font-semibold text-yellow-800 mb-2">💡 Focus Areas:</h3>
                                        {currentQ.highlightedSentences.map((highlight, index) => (
                                            <div key={index} className="mb-2">
                                                <button
                                                    onClick={() => setHighlightedSentence(highlight.sentence)}
                                                    className="text-yellow-700 hover:text-yellow-900 text-sm font-medium block w-full text-left"
                                                >
                                                    📍 {highlight.reason}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Right Column - Question */}
                <div className={`bg-white rounded-lg shadow-sm p-6 ${!currentQ.passage ? 'lg:col-span-2' : ''}`}>
                    <div className="mb-6">
                        <div className="flex items-center space-x-2 mb-3">
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm font-medium">
                                {currentQ.type.replace('_', ' ').toUpperCase()}
                            </span>
                            {currentQ.answerMode && currentQ.answerMode !== 'static' && (
                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
                                    {currentQ.answerMode.toUpperCase()} CHECK
                                </span>
                            )}
                        </div>

                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {currentQ.question}
                        </h2>

                        {currentQ.focusArea && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <div className="text-blue-800 text-sm">
                                    <strong>💭 Focus on:</strong> {currentQ.focusArea}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Answer Input */}
                    <div className="mb-6">
                        {currentQ.type === 'multiple_choice' && currentQ.options ? (
                            <div className="space-y-3">
                                {currentQ.options.map((option, index) => (
                                    <label
                                        key={index}
                                        className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="radio"
                                            name={`question-${currentQ.id}`}
                                            value={index}
                                            checked={answers[currentQ.id] === index}
                                            onChange={(e) => handleAnswerChange(currentQ.id.toString(), parseInt(e.target.value))}
                                            className="text-indigo-600 mr-3"
                                        />
                                        <span className="text-gray-900">{option}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div>
                                <textarea
                                    value={answers[currentQ.id] || ''}
                                    onChange={(e) => handleAnswerChange(currentQ.id.toString(), e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows={currentQ.type === 'essay' ? 6 : 3}
                                    placeholder={`Enter your ${currentQ.type.replace('_', ' ')} answer...`}
                                />
                                {currentQ.answerMode === 'keywords' && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        💡 Multiple correct answers are accepted for this question
                                    </p>
                                )}
                                {currentQ.answerMode === 'ai' && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        🤖 This answer will be evaluated by AI for meaning and understanding
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrevQuestion}
                            disabled={currentQuestion === 0}
                            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>

                        <span className="text-sm text-gray-600">
                            {Object.keys(answers).length} of {quiz.questions.length} answered
                        </span>

                        {currentQuestion === quiz.questions.length - 1 ? (
                            <button
                                onClick={submitQuiz}
                                disabled={submitting}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg font-medium flex items-center"
                            >
                                {submitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit Test'
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleNextQuestion}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium"
                            >
                                Next
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Formula Sheet (if available) */}
            {quiz.formulaeSheet && (
                <div className="mt-6 bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">📋 Formula Sheet</h3>
                    <div className="text-sm text-gray-700 whitespace-pre-line">
                        {quiz.formulaeSheet}
                    </div>
                </div>
            )}
        </div>
    );
}