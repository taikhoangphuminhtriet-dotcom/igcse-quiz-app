const { adminDb } = require('../../src/lib/firebase-admin');

interface ActiveTest {
    userId: string;
    quizId: string;
    startTime: Date;
    timeLimit: number; // in seconds
    answers: { [questionId: string]: any };
    currentQuestion: number;
    status: 'active' | 'completed' | 'expired';
    lastActivity: Date;
}

class TestPersistenceService {
    static async startTest(userId: string, quizId: string, timeLimit: number): Promise<string> {
        try {
            console.log(`🎯 Starting persistent test: ${quizId} for user: ${userId}`);

            // Check if user already has an active test for this quiz
            const existingTest = await this.getActiveTest(userId, quizId);
            if (existingTest) {
                throw new Error('You already have an active test session for this quiz');
            }

            const testSessionId = `${userId}_${quizId}_${Date.now()}`;
            const startTime = new Date();

            const activeTest: ActiveTest = {
                userId,
                quizId,
                startTime,
                timeLimit,
                answers: {},
                currentQuestion: 0,
                status: 'active',
                lastActivity: startTime
            };

            // Save active test session
            await adminDb.collection('active_tests').doc(testSessionId).set(activeTest);

            // Schedule auto-completion when timer expires
            setTimeout(async () => {
                await this.autoCompleteTest(testSessionId);
            }, timeLimit * 1000);

            console.log(`✅ Test session started: ${testSessionId}`);
            return testSessionId;

        } catch (error) {
            console.error('❌ Error starting test:', error);
            throw error;
        }
    }

    static async getActiveTest(userId: string, quizId: string): Promise<ActiveTest | null> {
        try {
            const snapshot = await adminDb.collection('active_tests')
                .where('userId', '==', userId)
                .where('quizId', '==', quizId)
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return { ...doc.data(), id: doc.id } as ActiveTest & { id: string };

        } catch (error) {
            console.error('❌ Error getting active test:', error);
            return null;
        }
    }

    static async updateTestProgress(
        testSessionId: string,
        questionId: string,
        answer: any,
        currentQuestion: number
    ): Promise<void> {
        try {
            const testRef = adminDb.collection('active_tests').doc(testSessionId);

            await testRef.update({
                [`answers.${questionId}`]: answer,
                currentQuestion,
                lastActivity: new Date()
            });

            console.log(`📝 Test progress updated: Q${currentQuestion + 1}`);

        } catch (error) {
            console.error('❌ Error updating test progress:', error);
            throw error;
        }
    }

    static async completeTest(testSessionId: string, finalAnswers: any[]): Promise<any> {
        try {
            console.log(`🏁 Completing test session: ${testSessionId}`);

            const testDoc = await adminDb.collection('active_tests').doc(testSessionId).get();
            if (!testDoc.exists) {
                throw new Error('Test session not found');
            }

            const testData = testDoc.data() as ActiveTest;
            const completionTime = new Date();
            const timeSpent = Math.floor((completionTime.getTime() - testData.startTime.getTime()) / 1000);
            const timerExpired = timeSpent >= testData.timeLimit;

            // Update test status
            await adminDb.collection('active_tests').doc(testSessionId).update({
                status: 'completed',
                completedAt: completionTime,
                finalAnswers,
                timeSpent,
                timerExpired
            });

            // Process the results and calculate XP
            const result = await this.processTestResults(testSessionId, testData, finalAnswers, timeSpent, timerExpired);

            console.log(`✅ Test completed: ${testSessionId}`);
            return result;

        } catch (error) {
            console.error('❌ Error completing test:', error);
            throw error;
        }
    }

    static async autoCompleteTest(testSessionId: string): Promise<void> {
        try {
            console.log(`⏰ Auto-completing expired test: ${testSessionId}`);

            const testDoc = await adminDb.collection('active_tests').doc(testSessionId).get();
            if (!testDoc.exists) return;

            const testData = testDoc.data() as ActiveTest;
            if (testData.status !== 'active') return; // Already completed

            const completionTime = new Date();
            const timeSpent = testData.timeLimit; // Full time elapsed

            // Mark as expired
            await adminDb.collection('active_tests').doc(testSessionId).update({
                status: 'expired',
                completedAt: completionTime,
                timeSpent,
                timerExpired: true,
                autoCompleted: true
            });

            // Convert current answers to final answers format
            const finalAnswers = Object.keys(testData.answers).map(questionId => ({
                questionId: parseInt(questionId),
                answer: testData.answers[questionId]
            }));

            // Process results for expired test
            await this.processTestResults(testSessionId, testData, finalAnswers, timeSpent, true);

            console.log(`⏰ Test auto-completed due to timer expiry: ${testSessionId}`);

        } catch (error) {
            console.error('❌ Error auto-completing test:', error);
        }
    }

    static async processTestResults(
        testSessionId: string,
        testData: ActiveTest,
        finalAnswers: any[],
        timeSpent: number,
        timerExpired: boolean
    ): Promise<any> {
        try {
            const { XPService } = require('./xp');

            // Get quiz data to calculate score
            const quizDoc = await adminDb.collection('quizzes').doc(testData.quizId).get();
            if (!quizDoc.exists) {
                throw new Error('Quiz not found');
            }

            const quizData = quizDoc.data();
            const questions = quizData.questions || [];

            // Calculate score
            let correctAnswers = 0;
            const answerResults = [];

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const userAnswer = finalAnswers.find(a => a.questionId === i)?.answer;
                const isCorrect = this.checkAnswer(question, userAnswer);

                if (isCorrect) correctAnswers++;
                answerResults.push(isCorrect);
            }

            const score = (correctAnswers / questions.length) * 100;
            const status = XPService.determinePassFail(correctAnswers, questions.length);
            const allQuestionsAnswered = finalAnswers.length === questions.length;
            const perfectScore = correctAnswers === questions.length;
            const combos = XPService.calculateComboCount(answerResults);

            // Check bonuses
            const isFirstAttempt = await XPService.isFirstAttempt(testData.userId, testData.quizId);
            const earlyBirdBonus = await XPService.isEarlyBird(testData.quizId);
            const timeBonus = XPService.isHappyHour();

            // Prepare test result
            const testResult = {
                userId: testData.userId,
                quizId: testData.quizId,
                quizTitle: quizData.title,
                score,
                totalQuestions: questions.length,
                correctAnswers,
                timeSpent,
                timeLimit: testData.timeLimit,
                completedAt: new Date(),
                timerExpired,
                allQuestionsAnswered,
                isFirstAttempt,
                xpEarned: 0, // Will be calculated
                combos,
                perfectScore,
                status,
                timeBonus,
                earlyBirdBonus,
                answers: finalAnswers,
                answerResults
            };

            // Calculate XP
            testResult.xpEarned = await XPService.calculateXP(testResult);

            // Record in history
            await XPService.recordTestHistory(testResult);

            return testResult;

        } catch (error) {
            console.error('❌ Error processing test results:', error);
            throw error;
        }
    }

    static checkAnswer(question: any, userAnswer: any): boolean {
        if (!userAnswer) return false;

        if (question.type === 'multiple_choice') {
            return userAnswer === question.correctAnswer;
        } else {
            // For text answers, implement simple comparison
            // This can be enhanced with the answer modes (static, keywords, AI)
            const correct = String(question.correctAnswer).toLowerCase().trim();
            const user = String(userAnswer).toLowerCase().trim();
            return correct === user;
        }
    }

    static async getTestSession(testSessionId: string): Promise<ActiveTest | null> {
        try {
            const testDoc = await adminDb.collection('active_tests').doc(testSessionId).get();
            if (!testDoc.exists) return null;

            return { ...testDoc.data(), id: testSessionId } as ActiveTest & { id: string };

        } catch (error) {
            console.error('❌ Error getting test session:', error);
            return null;
        }
    }

    static async getAllActiveTests(): Promise<ActiveTest[]> {
        try {
            const snapshot = await adminDb.collection('active_tests')
                .where('status', '==', 'active')
                .get();

            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));

        } catch (error) {
            console.error('❌ Error getting active tests:', error);
            return [];
        }
    }

    // Clean up old completed/expired tests (run periodically)
    static async cleanupOldTests(daysOld: number = 7): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const snapshot = await adminDb.collection('active_tests')
                .where('status', 'in', ['completed', 'expired'])
                .where('completedAt', '<', cutoffDate)
                .get();

            const batch = adminDb.batch();
            snapshot.docs.forEach((doc: any) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`🧹 Cleaned up ${snapshot.docs.length} old test sessions`);

        } catch (error) {
            console.error('❌ Error cleaning up old tests:', error);
        }
    }
}

module.exports = { TestPersistenceService };
export { }; // Force TypeScript to treat this as a module
