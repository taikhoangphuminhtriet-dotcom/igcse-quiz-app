'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [recentQuizzes, setRecentQuizzes] = useState([]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Welcome back, {user.username}!
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Ready to continue your IGCSE preparation journey?
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Account Type</div>
                        <div className="text-lg font-semibold text-indigo-600 capitalize">
                            {user.role}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-6 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Quizzes Completed</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {user.completedQuizzes?.length || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <div className="bg-green-100 p-3 rounded-full">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Average Score</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {user.performance && Object.keys(user.performance).length > 0
                                    ? Math.round(Object.values(user.performance).reduce((a: any, b: any) => a + b, 0) / Object.values(user.performance).length)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <div className="bg-purple-100 p-3 rounded-full">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Subjects Studied</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {user.performance ? Object.keys(user.performance).length : 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* For Students */}
                {user.role === 'user' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            <Link
                                href="/quizzes"
                                className="block bg-indigo-50 hover:bg-indigo-100 p-4 rounded-lg transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="bg-indigo-600 p-2 rounded-full">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-6 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="font-semibold text-gray-900">Take a Quiz</h3>
                                        <p className="text-sm text-gray-600">Browse and start a new quiz</p>
                                    </div>
                                </div>
                            </Link>

                            <Link
                                href="/leaderboard"
                                className="block bg-yellow-50 hover:bg-yellow-100 p-4 rounded-lg transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="bg-yellow-600 p-2 rounded-full">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="font-semibold text-gray-900">View Leaderboard</h3>
                                        <p className="text-sm text-gray-600">See how you rank against others</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                )}

                {/* For Developers */}
                {user.role === 'developer' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Developer Tools</h2>
                        <div className="space-y-3">
                            <Link
                                href="/upload"
                                className="block bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="bg-purple-600 p-2 rounded-full">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="font-semibold text-gray-900">Upload Papers</h3>
                                        <p className="text-sm text-gray-600">Upload IGCSE past papers and mark schemes</p>
                                    </div>
                                </div>
                            </Link>

                            <Link
                                href="/quizzes"
                                className="block bg-green-50 hover:bg-green-100 p-4 rounded-lg transition-colors"
                            >
                                <div className="flex items-center">
                                    <div className="bg-green-600 p-2 rounded-full">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-6 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="font-semibold text-gray-900">Manage Quizzes</h3>
                                        <p className="text-sm text-gray-600">View and manage created quizzes</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Performance Overview */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Performance by Subject</h2>
                    {user.performance && Object.keys(user.performance).length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(user.performance).map(([subject, score]) => (
                                <div key={subject} className="flex items-center justify-between">
                                    <span className="font-medium text-gray-700">{subject}</span>
                                    <div className="flex items-center">
                                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                                            <div
                                                className="bg-indigo-600 h-2 rounded-full"
                                                style={{ width: `${score}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">{score}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-6 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            <p className="text-gray-500">No quiz performance data yet</p>
                            <p className="text-sm text-gray-400 mt-1">Complete your first quiz to see your progress here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
