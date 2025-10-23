import { useState, useCallback, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Convert Firebase user to our User type
const convertFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || 'User',
    email: firebaseUser.email || '',
    avatar: firebaseUser.photoURL || undefined,
    isAuthenticated: true,
    subscription: 'free', // Default subscription
  };
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true, // Start as loading to check Firebase auth state
    error: null,
  });

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const user = convertFirebaseUser(firebaseUser);
        setAuthState({
          user,
          isLoading: false,
          error: null,
        });
        // Store in localStorage for quick access
        localStorage.setItem('auth_user', JSON.stringify(user));
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          error: null,
        });
        localStorage.removeItem('auth_user');
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = convertFirebaseUser(result.user);
      
      setAuthState({
        user,
        isLoading: false,
        error: null,
      });
      
      // Store in localStorage
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      // Return the full result so App.tsx can check for isNewUser
      return {
        user: user,
        isNewUser: result.additionalUserInfo?.isNewUser ?? false,
        _firebaseResult: result, // For debugging if needed
      };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      const errorMessage = error.code === 'auth/popup-closed-by-user' 
        ? 'Sign-in cancelled' 
        : 'Failed to sign in with Google';
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await firebaseSignOut(auth);
      
      setAuthState({
        user: null,
        isLoading: false,
        error: null,
      });
      
      // Remove from localStorage
      localStorage.removeItem('auth_user');
    } catch (error: any) {
      console.error('Sign-out error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to sign out',
      }));
      throw error;
    }
  }, []);

  // Keep the old signIn method for backward compatibility (but not used)
  const signIn = useCallback(async (userData: Omit<User, 'isAuthenticated'>) => {
    console.warn('Old signIn method called, use signInWithGoogle instead');
    // For backward compatibility, just set the user
    const user: User = {
      ...userData,
      isAuthenticated: true,
    };
    
    setAuthState({
      user,
      isLoading: false,
      error: null,
    });
    
    localStorage.setItem('auth_user', JSON.stringify(user));
    return user;
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setAuthState(prev => {
      if (!prev.user) return prev;
      
      const updatedUser = { ...prev.user, ...userData };
      
      // Update localStorage
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      
      return {
        ...prev,
        user: updatedUser,
      };
    });
  }, []);

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    error: authState.error,
    signIn, // Deprecated, kept for compatibility
    signInWithGoogle, // New Firebase Google sign-in
    signOut,
    updateUser,
  };
}
