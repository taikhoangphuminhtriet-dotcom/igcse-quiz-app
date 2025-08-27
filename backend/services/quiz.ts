const { adminDb } = require('../../src/lib/firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

class QuizService {
    static async createQuiz(quizData: any): Promise<string> {
        try {
            const docRef = await adminDb.collection('quizzes').add({
                ...quizData,
                createdAt: new Date(),
                totalMarks: this.calculateTotalMarks(quizData.questions)
            });
            return docRef.id;
        } catch (error) {
            console.error('Create quiz error:', error);
            throw new Error('Failed to create quiz');
        }
    }

    static async getQuizzes(subject?: string): Promise<any[]> {
        try {
            let query = adminDb.collection('quizzes');

            if (subject) {
                query = query.where('subject', '==', subject);
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .limit(50) // Limit for better performance
                .get();

            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Get quizzes error:', error);
            throw new Error('Failed to fetch quizzes');
        }
    }

    static async getQuizById(id: string): Promise<any | null> {
        try {
            const doc = await adminDb.collection('quizzes').doc(id).get();

            if (!doc.exists) {
                return null;
            }

            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Get quiz error:', error);
            throw new Error('Failed to fetch quiz');
        }
    }

    static async submitQuiz(userId: string, quizId: string, answers: any[]): Promise<any> {
        try {
            const quiz = await this.getQuizById(quizId);
            if (!quiz) {
                throw new Error('Quiz not found');
            }

            // Calculate score with optimized algorithm
            const result = this.calculateScore(quiz.questions, answers);

            // Save submission
            const submissionData = {
                userId,
                quizId,
                answers,
                ...result,
                completedAt: new Date()
            };

            await adminDb.collection('quiz_submissions').add(submissionData);

            // Update user performance efficiently
            await this.updateUserPerformance(userId, quiz.subject, result.percentage, quizId);

            // Update leaderboard
            await this.updateLeaderboard(userId, quiz.subject, result);

            return result;
        } catch (error) {
            console.error('Submit quiz error:', error);
            throw new Error('Failed to submit quiz');
        }
    }

    private static calculateTotalMarks(questions: any[]): number {
        return questions.reduce((total, question) => total + question.marks, 0);
    }

    private static calculateScore(questions: any[], answers: any[]): any {
        let score = 0;
        let correctCount = 0;
        const totalMarks = this.calculateTotalMarks(questions);

        // Create answer map for O(1) lookup instead of O(n) find operations
        const answerMap = new Map();
        answers.forEach(answer => {
            answerMap.set(answer.questionId, answer.answer);
        });

        // Calculate score efficiently
        questions.forEach(question => {
            const userAnswer = answerMap.get(question.id);
            if (userAnswer !== undefined && this.isCorrectAnswer(question, userAnswer)) {
                score += question.marks;
                correctCount++;
            }
        });

        const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

        return {
            score,
            totalMarks,
            percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
            correct: correctCount,
            total: questions.length
        };
    }

    private static isCorrectAnswer(question: any, userAnswer: any): boolean {
        // Handle different question types
        switch (question.type) {
            case 'mcq':
                return userAnswer === question.correctAnswer;
            case 'short_answer':
                // Case-insensitive comparison for short answers
                return userAnswer.toString().toLowerCase().trim() ===
                    question.correctAnswer.toString().toLowerCase().trim();
            case 'essay':
                // For essays, you might want more sophisticated comparison
                // For now, just check if user provided substantial content
                return userAnswer.toString().trim().length >= 50;
            default:
                return false;
        }
    }

    private static async updateUserPerformance(userId: string, subject: string, percentage: number, quizId: string): Promise<void> {
        try {
            const userRef = adminDb.collection('users').doc(userId);

            await userRef.update({
                [`performance.${subject}`]: percentage,
                completedQuizzes: FieldValue.arrayUnion(quizId),
                lastQuizDate: new Date()
            });
        } catch (error) {
            console.error('Update user performance error:', error);
            // Don't throw here, as the main submission should still succeed
        }
    }

    private static async updateLeaderboard(userId: string, subject: string, result: any): Promise<void> {
        try {
            const leaderboardRef = adminDb.collection('leaderboards').doc(subject);
            const userDoc = await adminDb.collection('users').doc(userId).get();
            const userData = userDoc.data();

            const newEntry = {
                username: userData?.username || 'Anonymous',
                userId,
                score: result.score,
                percentage: result.percentage,
                completedAt: new Date()
            };

            // Use transaction for atomic leaderboard update
            await adminDb.runTransaction(async (transaction: any) => {
                const leaderboardDoc = await transaction.get(leaderboardRef);

                if (leaderboardDoc.exists) {
                    const currentData = leaderboardDoc.data();
                    const topScores = [...(currentData?.topScores || []), newEntry]
                        .sort((a, b) => b.percentage - a.percentage)
                        .slice(0, 10); // Keep top 10

                    transaction.update(leaderboardRef, { topScores });
                } else {
                    transaction.set(leaderboardRef, {
                        subject,
                        topScores: [newEntry]
                    });
                }
            });
        } catch (error) {
            console.error('Update leaderboard error:', error);
            // Don't throw here, as the main submission should still succeed
        }
    }
}

module.exports = { QuizService };
export { }; // Force TypeScript to treat this as a module
