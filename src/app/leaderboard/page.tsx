'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface LeaderboardEntry {
    username: string;
    userId: string;
    score: number;
    percentage: number;
    completedAt: any;
}

interface SubjectLeaderboard {
    subject: string;
    topScores: LeaderboardEntry[];
}

export default function LeaderboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [selectedSubject, setSelectedSubject] = useState('Math');
    const [leaderboard, setLeaderboard] = useState<SubjectLeaderboard | null>(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

    const subjects = ['Math', 'English', 'Science', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology'];

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchLeaderboard();
        }
    }, [user, selectedSubject]);

    const fetchLeaderboard = async () => {
        setLoadingLeaderboard(true);
        try {
            const response = await fetch(`http://localhost:3001/api/leaderboard/${selectedSubject}`);
            const result = await response.json();

            if (result.success) {
                setLeaderboard(result.data);
            } else {
                console.error('Failed to fetch leaderboard:', result.error);
                setLeaderboard({ subject: selectedSubject, topScores: [] });
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            setLeaderboard({ subject: selectedSubject, topScores: [] });
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return '🥇';
            case 2:
                return '🥈';
            case 3:
                return '🥉';
            default:
                return `#${rank}`;
        }
    };

    const getScoreColor = (percentage: number) => {
        if (percentage >= 90) return 'text-green-600';
        if (percentage >= 80) return 'text-blue-600';
        if (percentage >= 70) return 'text-yellow-600';
        return 'text-gray-600';
    };

    const getScoreBg = (percentage: number) => {
        if (percentage >= 90) return 'bg-green-50 border-green-200';
        if (percentage >= 80) return 'bg-blue-50 border-blue-200';
        if (percentage >= 70) return 'bg-yellow-50 border-yellow-200';
        return 'bg-gray-50 border-gray-200';
    };

    if (loading || loadingLeaderboard) {
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
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">🏆 XP Leaderboard</h1>
                <p className="text-gray-600">
                    See how you rank by Experience Points (XP) earned from taking quizzes and achieving milestones.
                </p>
            </div>

            {/* Subject Filter */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Subject</h2>
                <div className="flex flex-wrap gap-2">
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

            {/* Leaderboard */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {selectedSubject} Leaderboard
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Top performers in {selectedSubject}
                    </p>
                </div>

                {leaderboard && leaderboard.topScores.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {leaderboard.topScores.map((entry, index) => {
                            const rank = index + 1;
                            const isCurrentUser = entry.userId === user.uid;

                            return (
                                <div
                                    key={`${entry.userId}-${entry.completedAt}`}
                                    className={`p-6 transition-colors ${isCurrentUser ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${rank <= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {getRankIcon(rank)}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className={`text-lg font-semibold ${isCurrentUser ? 'text-indigo-900' : 'text-gray-900'
                                                    }`}>
                                                    {entry.username}
                                                    {isCurrentUser && (
                                                        <span className="ml-2 text-sm font-normal text-indigo-600">(You)</span>
                                                    )}
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    Completed on {new Date(entry.completedAt.seconds * 1000).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-2xl font-bold mb-1 text-purple-600">
                                                {entry.totalXP || entry.score || 0} XP
                                            </div>
                                            <div className="text-sm px-3 py-1 rounded-full border bg-purple-50 border-purple-200 text-purple-700">
                                                ⭐ Experience Points
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No XP earned yet</h3>
                        <p className="text-gray-600 mb-4">
                            Be the first to earn XP and appear on the leaderboard!
                        </p>
                        <button
                            onClick={() => router.push('/quizzes')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            Take a Quiz
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-7.5a6 6 0 11-13 0 6 6 0 0113 0z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Participants</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {leaderboard?.topScores.length || 0}
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
                                {leaderboard && leaderboard.topScores.length > 0
                                    ? Math.round(leaderboard.topScores.reduce((sum, entry) => sum + entry.percentage, 0) / leaderboard.topScores.length)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <div className="bg-yellow-100 p-3 rounded-full">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Highest Score</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {leaderboard && leaderboard.topScores.length > 0
                                    ? Math.round(leaderboard.topScores[0].percentage)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
