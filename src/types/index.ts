// User types
export interface User {
    uid: string;
    username: string;
    email: string;
    role: 'developer' | 'user' | 'owner';
    isOwner?: boolean;
    totalXP?: number;
    permissions?: {
        canManageUsers?: boolean;
        canDeleteContent?: boolean;
        canViewAnalytics?: boolean;
        canManageDevelopers?: boolean;
        canAccessAllQuizzes?: boolean;
        canModifyLeaderboard?: boolean;
    };
    createdAt: Date;
    completedQuizzes: string[];
    performance: {
        [subject: string]: number;
    };
}

// Paper types
export interface Paper {
    id: string;
    title: string;
    subject: string;
    pdfUrl: string;
    jsonQuestionsUrl?: string;
    uploadedBy: string;
    createdAt: Date;
}

// Question types
export interface Question {
    id: string;
    type: 'mcq' | 'short_answer' | 'essay';
    question: string;
    options?: string[]; // For MCQ questions
    correctAnswer?: string | number; // For MCQ (index) or short answer
    marks: number;
    explanation?: string;
}

// Quiz types
export interface Quiz {
    id: string;
    paperId: string;
    title: string;
    subject: string;
    questions: Question[];
    createdAt: Date;
    totalMarks: number;
}

// Quiz submission types
export interface QuizSubmission {
    quizId: string;
    userId: string;
    answers: {
        questionId: string;
        answer: string | number;
    }[];
    score: number;
    totalMarks: number;
    percentage: number;
    completedAt: Date;
}

// Leaderboard types
export interface LeaderboardEntry {
    username: string;
    userId: string;
    score: number;
    percentage: number;
    completedAt: Date;
}

export interface Leaderboard {
    subject: string;
    topScores: LeaderboardEntry[];
}

// API Response types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Auth context types
export interface AuthContextType {
    user: (User & { getIdToken?: () => Promise<string> }) | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, username: string, role: 'user' | 'developer') => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
}

// File upload types
export interface FileUploadResponse {
    success: boolean;
    url?: string;
    error?: string;
}
