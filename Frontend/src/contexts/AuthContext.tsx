import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '@/lib/storage';
import { seedUsers } from '@/lib/seed-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isStaff: boolean;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const resolveDisplayName = (email: string, fallback?: string | null) => {
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  const [localPart] = email.split('@');
  return localPart || 'Member';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfile = useCallback(async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load user profile', error);
      return null;
    }

    if (data) {
      return data as User;
    }

    const email = authUser.email || '';
    const nameFromMetadata = typeof authUser.user_metadata?.name === 'string'
      ? (authUser.user_metadata?.name as string)
      : undefined;
    const newUser: User = {
      id: authUser.id,
      email,
      name: resolveDisplayName(email, nameFromMetadata),
      role: 'member',
    };

    const { error: insertError } = await supabase.from('users').insert(newUser);
    if (insertError) {
      console.warn('Failed to insert user profile', insertError);
      return null;
    }

    return newUser;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData.session?.user;
        if (authUser) {
          const profile = await loadUserProfile({
            id: authUser.id,
            email: authUser.email,
            user_metadata: authUser.user_metadata,
          });
          if (profile && isMounted) {
            setUser(profile);
          }
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
          const nextUser = session?.user;
          if (!nextUser) {
            if (isMounted) setUser(null);
            return;
          }
          const profile = await loadUserProfile({
            id: nextUser.id,
            email: nextUser.email,
            user_metadata: nextUser.user_metadata,
          });
          if (profile && isMounted) {
            setUser(profile);
          }
        });

        if (isMounted) setIsLoading(false);
        return;
      }

      // Local fallback for non-supabase setups
      let users: User[] = seedUsers;
      const existingUsers = getStorageItem<User[]>(STORAGE_KEYS.USERS);
      if (!existingUsers) {
        setStorageItem(STORAGE_KEYS.USERS, users);
      } else {
        users = existingUsers;
      }

      const currentUser = getStorageItem<User>(STORAGE_KEYS.CURRENT_USER);
      if (currentUser && isMounted) {
        setUser(currentUser);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [loadUserProfile]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return false;
      }
      const profile = await loadUserProfile({
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      });
      if (!profile) return false;
      setUser(profile);
      return true;
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS) || seedUsers;
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (foundUser) {
      setUser(foundUser);
      setStorageItem(STORAGE_KEYS.CURRENT_USER, foundUser);
      return true;
    }
    return false;
  }, [loadUserProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error || !data.user) {
      return false;
    }

    const profile = await loadUserProfile({
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    });

    if (!profile) return false;
    setUser(profile);
    return true;
  }, [loadUserProfile]);

  const logout = useCallback(() => {
    if (isSupabaseConfigured && supabase) {
      void supabase.auth.signOut();
    }
    setUser(null);
    removeStorageItem(STORAGE_KEYS.CURRENT_USER);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
    if (!isSupabaseConfigured) {
      const currentUser = getStorageItem<User>(STORAGE_KEYS.CURRENT_USER);
      if (currentUser) {
        setStorageItem(STORAGE_KEYS.CURRENT_USER, { ...currentUser, ...updates });
      }
      const users = getStorageItem<User[]>(STORAGE_KEYS.USERS);
      if (users && currentUser) {
        const nextUsers = users.map((existing) =>
          existing.id === currentUser.id ? { ...existing, ...updates } : existing
        );
        setStorageItem(STORAGE_KEYS.USERS, nextUsers);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    signUp,
    logout,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff' || user?.role === 'admin',
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
