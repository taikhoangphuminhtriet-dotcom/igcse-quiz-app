'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

export const Navbar: React.FC = () => {
    const { user, signOut } = useAuth();

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <nav className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex-shrink-0">
                            <h1 className="text-xl font-bold text-indigo-600">
                                IGCSE Quiz App
                            </h1>
                        </Link>

                        {user && (
                            <div className="hidden md:block ml-10">
                                <div className="flex items-baseline space-x-4">
                                    <Link
                                        href="/dashboard"
                                        className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        href="/quizzes"
                                        className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        Quizzes
                                    </Link>
                                    <Link
                                        href="/leaderboard"
                                        className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        🏆 Leaderboard
                                    </Link>
                                    <Link
                                        href="/test-history"
                                        className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        📚 History
                                    </Link>
                                    {(user.role === 'developer' || user.role === 'owner') && (
                                        <Link
                                            href="/upload"
                                            className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                        >
                                            📝 Create Tests
                                        </Link>
                                    )}
                                    {(user.role === 'developer' || user.role === 'owner') && (
                                        <Link
                                            href="/upload/quiz-creator"
                                            className="text-purple-600 hover:text-purple-700 px-3 py-2 rounded-md text-sm font-medium font-bold"
                                        >
                                            🤖 AI Quiz Creator
                                        </Link>
                                    )}
                                    {user.role === 'owner' && (
                                        <Link
                                            href="/admin"
                                            className="text-red-600 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium font-bold"
                                        >
                                            Admin Panel
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center">
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <span className="text-gray-700 text-sm">
                                    Welcome, {user.username}
                                </span>
                                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                                    {user.role}
                                </span>
                                <button
                                    onClick={handleSignOut}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-4">
                                <Link
                                    href="/auth"
                                    className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/auth"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
