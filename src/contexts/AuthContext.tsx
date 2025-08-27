'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User as FirebaseUser,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                // Get user data from Firestore
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                                setUser({
                uid: firebaseUser.uid,
                username: userData.username,
                email: firebaseUser.email || '',
                role: userData.role,
                isOwner: userData.isOwner || false,
                permissions: userData.permissions || {},
                createdAt: userData.createdAt?.toDate() || new Date(),
                completedQuizzes: userData.completedQuizzes || [],
                performance: userData.performance || {},
                getIdToken: () => firebaseUser.getIdToken(),
            });
                } else {
                    // User exists in Firebase Auth but not in Firestore
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const signUp = async (email: string, password: string, username: string, role: 'user' | 'developer') => {
        setLoading(true);
        try {
            const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);

            // Create user document in Firestore
            const userData = {
                username,
                email,
                role,
                createdAt: new Date(),
                completedQuizzes: [],
                performance: {},
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const signOut = async () => {
        setLoading(true);
        try {
            await firebaseSignOut(auth);
            setUser(null);
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const { user: firebaseUser } = await signInWithPopup(auth, provider);

            // Check if user already exists in Firestore
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Create new user document for Google sign-in
                const userData = {
                    username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                    email: firebaseUser.email || '',
                    role: 'user', // Default to user role for Google sign-in
                    createdAt: new Date(),
                    completedQuizzes: [],
                    performance: {},
                };

                await setDoc(userDocRef, userData);
            }
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
