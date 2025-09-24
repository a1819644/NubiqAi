import { useState, useCallback } from 'react';
import type { User } from '../App';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: false,
    error: null,
  });

  const signIn = useCallback(async (userData: Omit<User, 'isAuthenticated'>) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const user: User = {
        ...userData,
        isAuthenticated: true,
      };
      
      setAuthState({
        user,
        isLoading: false,
        error: null,
      });
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to sign in',
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAuthState({
        user: null,
        isLoading: false,
        error: null,
      });
      
      // Remove from localStorage
      localStorage.removeItem('auth_user');
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to sign out',
      }));
      throw error;
    }
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

  const initializeAuth = useCallback(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAuthState({
          user,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        localStorage.removeItem('auth_user');
      }
    }
  }, []);

  return {
    ...authState,
    signIn,
    signOut,
    updateUser,
    initializeAuth,
  };
}