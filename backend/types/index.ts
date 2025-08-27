export interface User {
    uid: string;
    email?: string;
    [key: string]: any;
}

export interface Question {
    id: string;
    type: 'mcq' | 'short_answer' | 'essay';
    question: string;
    options?: string[];
    correctAnswer: string | number;
    marks: number;
    explanation?: string;
}

export interface Quiz {
    id?: string;
    paperId: string;
    title: string;
    subject: string;
    questions: Question[];
    totalMarks: number;
    createdAt: Date;
}

export interface AuthRequest extends Express.Request {
    user?: User;
    file?: Express.Multer.File;
}

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
