'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface TestHistoryItem {
    id: string;
    quizId: string;
    quizTitle: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number;
    timeLimit: number;
    completedAt: Date;
    timerExpired: boolean;
    allQuestionsAnswered: boolean;
    isFirstAttempt: boolean;
    xpEarned: number;
    combos: number;
    perfectScore: boolean;
    status: 'pass' | 'fail';
    timeBonus: boolean;
    earlyBirdBonus: boolean;
}

interface UserStats {
    totalXP: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
    averageScore: number;
    recentHistory: TestHistoryItem[];
}

export default function TestHistoryPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [history, setHistory] = useState<TestHistoryItem[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchHistory();
            fetchStats();
        }
    }, [user]);

    const fetchHistory = async () => {
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch('http://localhost:3001/api/test-history', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const result = await response.json();
            if (result.success) {
                setHistory(result.data);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = await user?.getIdToken?.();
            const response = await fetch('http://localhost:3001/api/user-stats', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const result = await response.json();
            if (result.success) {
                setStats(result.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredHistory = history.filter(item => {
        if (filter === 'all') return true;
        return item.status === filter;
    });

    if (loading || loadingHistory) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">📚 Test History</h1>
                <p className="text-gray-600">Track your progress and view detailed test results</p>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.totalXP}</div>
                                <div className="text-purple-100">Total XP</div>
                            </div>
                            <div className="text-3xl">⭐</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.totalTests}</div>
                                <div className="text-blue-100">Tests Taken</div>
                            </div>
                            <div className="text-3xl">📝</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{Math.round(stats.passRate)}%</div>
                                <div className="text-green-100">Pass Rate</div>
                            </div>
                            <div className="text-3xl">✅</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.averageScore}%</div>
                                <div className="text-orange-100">Avg Score</div>
                            </div>
                            <div className="text-3xl">📊</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Test Results</h2>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium ${filter === 'all'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All ({history.length})
                        </button>
                        <button
                            onClick={() => setFilter('pass')}
                            className={`px-4 py-2 rounded-lg font-medium ${filter === 'pass'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Passed ({history.filter(h => h.status === 'pass').length})
                        </button>
                        <button
                            onClick={() => setFilter('fail')}
                            className={`px-4 py-2 rounded-lg font-medium ${filter === 'fail'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Failed ({history.filter(h => h.status === 'fail').length})
                        </button>
                    </div>
                </div>

                {/* History List */}
                {filteredHistory.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No test history yet</h3>
                        <p className="text-gray-600 mb-6">Start taking quizzes to see your progress here!</p>
                        <button
                            onClick={() => router.push('/quizzes')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            Browse Quizzes
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map((item) => (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">{item.quizTitle}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'pass'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {item.status === 'pass' ? '✅ PASSED' : '❌ FAILED'}
                                            </span>
                                            {item.isFirstAttempt && (
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                                    🏆 First Attempt
                                                </span>
                                            )}
                                            {item.perfectScore && (
                                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                                    ✨ Perfect
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                            <div>
                                                <span className="font-medium">Score:</span> {Math.round(item.score)}%
                                            </div>
                                            <div>
                                                <span className="font-medium">Correct:</span> {item.correctAnswers}/{item.totalQuestions}
                                            </div>
                                            <div>
                                                <span className="font-medium">Time:</span> {formatTime(item.timeSpent)}
                                            </div>
                                            <div>
                                                <span className="font-medium">XP:</span> +{item.xpEarned}
                                            </div>
                                        </div>

                                        {/* Bonuses */}
                                        {(item.combos > 1 || item.timeBonus || item.earlyBirdBonus || item.timerExpired) && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {item.combos > 1 && (
                                                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                                        🔥 {item.combos} Combo
                                                    </span>
                                                )}
                                                {item.timeBonus && (
                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                        ⏰ Time Bonus
                                                    </span>
                                                )}
                                                {item.earlyBirdBonus && (
                                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                        🐦 Early Bird
                                                    </span>
                                                )}
                                                {item.timerExpired && (
                                                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                                        ⏱️ Time Expired
                                                    </span>
                                                )}
                                                {!item.allQuestionsAnswered && (
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                                        ⚠️ Incomplete
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm text-gray-500">{formatDate(item.completedAt)}</div>
                                        <button
                                            onClick={() => router.push(`/quiz/${item.quizId}`)}
                                            className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                        >
                                            Retake Quiz
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex justify-center">
                <button
                    onClick={() => router.push('/quizzes')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                    Take More Quizzes
                </button>
            </div>
        </div>
    );
}
