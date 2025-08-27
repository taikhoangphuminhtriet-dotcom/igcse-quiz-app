'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quiz {
    id: string;
    title: string;
    subject: string;
    totalMarks: number;
    questions: any[];
    createdAt: any;
}

export default function QuizzesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);

    const subjects = ['Math', 'English', 'Science', 'History', 'Geography'];

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchQuizzes();
        }
    }, [user, selectedSubject]);

    const fetchQuizzes = async () => {
        setLoadingQuizzes(true);
        try {
            const endpoint = selectedSubject === 'all'
                ? 'http://localhost:3001/api/quizzes'
                : `http://localhost:3001/api/quizzes/${selectedSubject}`;

            const response = await fetch(endpoint);
            const result = await response.json();

            if (result.success) {
                setQuizzes(result.data || []);
            } else {
                console.error('Failed to fetch quizzes:', result.error);
                setQuizzes([]);
            }
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            setQuizzes([]);
        } finally {
            setLoadingQuizzes(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Available Quizzes</h1>
                <p className="text-gray-600">
                    Choose from our collection of AI-generated quizzes based on IGCSE past papers.
                </p>
            </div>

            {/* Subject Filter */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Subject</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedSubject('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedSubject === 'all'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        All Subjects
                    </button>
                    {subjects.map((subject) => (
                        <button
                            key={subject}
                            onClick={() => setSelectedSubject(subject)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedSubject === subject
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {subject}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quiz Grid */}
            {loadingQuizzes ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : quizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-1 rounded-full">
                                        {quiz.subject}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {quiz.totalMarks} marks
                                    </span>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                    {quiz.title}
                                </h3>

                                <div className="flex items-center text-sm text-gray-600 mb-4">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {quiz.questions.length} questions
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-500">
                                        {user.completedQuizzes?.includes(quiz.id) ? (
                                            <span className="text-green-600 font-medium flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Completed
                                            </span>
                                        ) : (
                                            <span className="text-gray-600">Not started</span>
                                        )}
                                    </div>

                                    <Link
                                        href={`/quiz/${quiz.id}`}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {user.completedQuizzes?.includes(quiz.id) ? 'Retake' : 'Start Quiz'}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-6 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No quizzes available</h3>
                    <p className="text-gray-600 mb-4">
                        {selectedSubject === 'all'
                            ? 'No quizzes have been created yet.'
                            : `No quizzes available for ${selectedSubject}.`}
                    </p>
                    {user.role === 'developer' && (
                        <Link
                            href="/upload"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium inline-block"
                        >
                            Upload Papers to Create Quizzes
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
