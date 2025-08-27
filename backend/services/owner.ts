const { adminDb, adminAuth } = require('../../src/lib/firebase-admin');

class OwnerService {
    static async initializeOwner() {
        const OWNER_EMAIL = 'taikhoangphuminhtriet@gmail.com';

        try {
            console.log(`🔧 Checking for owner account: ${OWNER_EMAIL}`);

            // Check if owner exists in Firebase Auth
            let ownerUser;
            try {
                ownerUser = await adminAuth.getUserByEmail(OWNER_EMAIL);
                console.log('✅ Owner account found in Firebase Auth');
            } catch (error) {
                // Owner doesn't exist in Firebase Auth yet
                console.log('⚠️ Owner account not found in Firebase Auth - will be created on first login');
                return;
            }

            // Check if owner exists in Firestore
            const ownerDoc = await adminDb.collection('users').doc(ownerUser.uid).get();

            if (!ownerDoc.exists) {
                // Create owner document in Firestore
                await adminDb.collection('users').doc(ownerUser.uid).set({
                    uid: ownerUser.uid,
                    email: OWNER_EMAIL,
                    username: 'Admin',
                    role: 'owner', // Special owner role
                    permissions: {
                        canManageUsers: true,
                        canDeleteContent: true,
                        canViewAnalytics: true,
                        canManageDevelopers: true,
                        canAccessAllQuizzes: true,
                        canModifyLeaderboard: true
                    },
                    isOwner: true,
                    createdAt: new Date(),
                    lastLogin: new Date()
                });

                console.log('✅ Owner account initialized in Firestore with full permissions');
            } else {
                // Update existing owner to ensure they have all permissions
                const currentData = ownerDoc.data();
                if (!currentData.isOwner || currentData.role !== 'owner') {
                    await adminDb.collection('users').doc(ownerUser.uid).update({
                        role: 'owner',
                        isOwner: true,
                        permissions: {
                            canManageUsers: true,
                            canDeleteContent: true,
                            canViewAnalytics: true,
                            canManageDevelopers: true,
                            canAccessAllQuizzes: true,
                            canModifyLeaderboard: true
                        },
                        lastLogin: new Date()
                    });
                    console.log('✅ Owner permissions updated');
                } else {
                    console.log('✅ Owner account already configured');
                }
            }
        } catch (error) {
            console.error('❌ Error initializing owner:', error);
        }
    }

    static async isOwner(userId: string): Promise<boolean> {
        try {
            const userDoc = await adminDb.collection('users').doc(userId).get();
            if (!userDoc.exists) return false;

            const userData = userDoc.data();
            return userData?.isOwner === true || userData?.role === 'owner';
        } catch (error) {
            console.error('Error checking owner status:', error);
            return false;
        }
    }

    static async hasPermission(userId: string, permission: string): Promise<boolean> {
        try {
            const userDoc = await adminDb.collection('users').doc(userId).get();
            if (!userDoc.exists) return false;

            const userData = userDoc.data();

            // Owner has all permissions
            if (userData?.isOwner || userData?.role === 'owner') {
                return true;
            }

            // Check specific permission
            return userData?.permissions?.[permission] === true;
        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }
}

module.exports = { OwnerService };
export { }; // Force TypeScript to treat this as a module
