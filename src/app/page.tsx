'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          AI-Powered IGCSE Quiz App
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Transform your IGCSE preparation with AI-generated quizzes from past papers.
          Upload PDFs, take interactive quizzes, and track your progress on the leaderboard.
        </p>

        {user ? (
          <div className="space-x-4">
            <Link
              href="/dashboard"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-lg font-semibold inline-block"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/quizzes"
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-600 px-8 py-3 rounded-lg text-lg font-semibold inline-block"
            >
              Browse Quizzes
            </Link>
          </div>
        ) : (
          <div className="space-x-4">
            <Link
              href="/auth"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-lg font-semibold inline-block"
            >
              Get Started
            </Link>
            <Link
              href="/auth"
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-600 px-8 py-3 rounded-lg text-lg font-semibold inline-block"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white rounded-lg shadow-sm">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Powerful Features for IGCSE Success
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our AI-powered platform makes studying for IGCSE exams more efficient and engaging than ever before.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 px-8">
          <div className="text-center">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">AI PDF Parsing</h3>
            <p className="text-gray-600">
              Upload past papers and mark schemes. Our AI automatically extracts and structures questions for interactive quizzes.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Interactive Quizzes</h3>
            <p className="text-gray-600">
              Take quizzes with multiple choice, short answer, and essay questions. Get instant feedback and explanations.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Performance Tracking</h3>
            <p className="text-gray-600">
              Track your progress across subjects and compete with others on the leaderboard. See your improvement over time.
            </p>
          </div>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Simple steps to get started with AI-powered IGCSE quiz preparation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">For Students</h3>
            <ol className="space-y-3">
              <li className="flex items-start">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">1</span>
                <span>Create your account and sign in</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">2</span>
                <span>Browse available quizzes by subject</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">3</span>
                <span>Take interactive quizzes and get instant feedback</span>
          </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">4</span>
                <span>Track your progress and compete on leaderboards</span>
          </li>
        </ol>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">For Developers</h3>
            <ol className="space-y-3">
              <li className="flex items-start">
                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">1</span>
                <span>Create a developer account</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">2</span>
                <span>Upload IGCSE past papers and mark schemes (PDF)</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">3</span>
                <span>AI automatically parses and structures questions</span>
              </li>
              <li className="flex items-start">
                <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">4</span>
                <span>Quizzes are instantly available for students</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
