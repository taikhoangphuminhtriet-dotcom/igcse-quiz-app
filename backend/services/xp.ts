const { adminDb } = require('../../src/lib/firebase-admin');

interface TestResult {
    userId: string;
    quizId: string;
    quizTitle: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number; // in seconds
    timeLimit: number; // in seconds
    completedAt: Date;
    timerExpired: boolean;
    allQuestionsAnswered: boolean;
    isFirstAttempt: boolean;
    xpEarned: number;
    combos: number;
    perfectScore: boolean;
    status: 'pass' | 'fail';
    timeBonus: boolean; // 5-7 PM bonus
    earlyBirdBonus: boolean; // within 2 hours of publication
}

class XPService {
    static async calculateXP(testResult: TestResult): Promise<number> {
        try {
            console.log('🧮 Calculating XP for test result...');

            let totalXP = 0;
            const {
                correctAnswers,
                isFirstAttempt,
                timerExpired,
                allQuestionsAnswered,
                perfectScore,
                combos,
                timeBonus,
                earlyBirdBonus,
                status
            } = testResult;

            // Base completion XP (only if passed)
            if (status === 'pass') {
                if (!timerExpired) {
                    totalXP += 10; // Completed without timer running out
                } else if (allQuestionsAnswered) {
                    totalXP += 5; // Timer ran out but finished all questions
                }
                // No XP if timer ran out and didn't finish
            }

            // Question-based XP (only for first attempts)
            if (isFirstAttempt) {
                // Base XP per correct answer
                let questionXP = correctAnswers * 50;

                // Combo multiplier (after 2+ correct answers in a row)
                if (combos >= 2) {
                    questionXP *= 1.5;
                    console.log(`🔥 Combo bonus applied: ${combos} correct in a row`);
                }

                totalXP += questionXP;

                // Deduct XP for wrong answers (only first attempt)
                const wrongAnswers = testResult.totalQuestions - correctAnswers;
                totalXP -= wrongAnswers * 15;

                // Early bird bonus (within 2 hours of quiz publication)
                if (earlyBirdBonus) {
                    totalXP += 20;
                    console.log('🐦 Early bird bonus: +20 XP');
                }
            }

            // Time-based bonus (5-7 PM everyday, only first attempt)
            if (isFirstAttempt && timeBonus) {
                totalXP *= 1.3;
                console.log('⏰ Time bonus applied: 1.3x multiplier (5-7 PM)');
            }

            // Perfect score bonus (no wrong answers)
            if (perfectScore && isFirstAttempt) {
                totalXP *= 1.2;
                console.log('✨ Perfect score bonus: 1.2x multiplier');
            }

            // Ensure minimum XP is 0
            totalXP = Math.max(0, Math.floor(totalXP));

            console.log(`💰 Total XP calculated: ${totalXP}`);
            return totalXP;

        } catch (error) {
            console.error('❌ Error calculating XP:', error);
            return 0;
        }
    }

    static async recordTestHistory(testResult: TestResult): Promise<void> {
        try {
            console.log('📚 Recording test history...');

            const historyId = `${testResult.userId}_${testResult.quizId}_${Date.now()}`;

            // Record in test_history collection
            await adminDb.collection('test_history').doc(historyId).set({
                ...testResult,
                recordedAt: new Date()
            });

            // Update user's total XP
            await this.updateUserXP(testResult.userId, testResult.xpEarned);

            console.log(`✅ Test history recorded: ${historyId}`);

        } catch (error) {
            console.error('❌ Error recording test history:', error);
            throw error;
        }
    }

    static async updateUserXP(userId: string, xpGained: number): Promise<void> {
        try {
            const userRef = adminDb.collection('users').doc(userId);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const currentXP = userDoc.data()?.totalXP || 0;
                await userRef.update({
                    totalXP: currentXP + xpGained,
                    lastXPUpdate: new Date()
                });

                console.log(`💰 User XP updated: +${xpGained} (Total: ${currentXP + xpGained})`);
            }

        } catch (error) {
            console.error('❌ Error updating user XP:', error);
            throw error;
        }
    }

    static async getUserHistory(userId: string, limit: number = 20): Promise<TestResult[]> {
        try {
            const historySnapshot = await adminDb.collection('test_history')
                .where('userId', '==', userId)
                .orderBy('completedAt', 'desc')
                .limit(limit)
                .get();

            const history = historySnapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));

            return history;

        } catch (error) {
            console.error('❌ Error fetching user history:', error);
            return [];
        }
    }

    static async isFirstAttempt(userId: string, quizId: string): Promise<boolean> {
        try {
            // Only count completed tests (not abandoned/expired) as attempts
            const historySnapshot = await adminDb.collection('test_history')
                .where('userId', '==', userId)
                .where('quizId', '==', quizId)
                .where('status', 'in', ['pass', 'fail'])
                .limit(1)
                .get();

            return historySnapshot.empty;

        } catch (error) {
            console.error('❌ Error checking first attempt:', error);
            return false;
        }
    }

    static async isEarlyBird(quizId: string): Promise<boolean> {
        try {
            const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
            if (!quizDoc.exists) return false;

            const quizData = quizDoc.data();
            const publishedAt = quizData?.publishedAt?.toDate() || quizData?.createdAt?.toDate();

            if (!publishedAt) return false;

            const now = new Date();
            const timeDiff = now.getTime() - publishedAt.getTime();
            const hoursElapsed = timeDiff / (1000 * 60 * 60);

            return hoursElapsed <= 2; // Within 2 hours of publication

        } catch (error) {
            console.error('❌ Error checking early bird status:', error);
            return false;
        }
    }

    static isHappyHour(): boolean {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 17 && hour < 19; // 5 PM to 7 PM
    }

    static calculateComboCount(answers: boolean[]): number {
        let maxCombo = 0;
        let currentCombo = 0;

        for (const isCorrect of answers) {
            if (isCorrect) {
                currentCombo++;
                maxCombo = Math.max(maxCombo, currentCombo);
            } else {
                currentCombo = 0;
            }
        }

        return maxCombo;
    }

    static determinePassFail(score: number, totalQuestions: number): 'pass' | 'fail' {
        const percentage = (score / totalQuestions) * 100;
        return percentage >= 75 ? 'pass' : 'fail';
    }
}

module.exports = { XPService };
export { }; // Force TypeScript to treat this as a module
