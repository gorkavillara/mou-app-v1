'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase';
import type { User, UserRole } from '@/lib/database.types';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

interface AuthContextType {
  supabase: SupabaseClient<import('@/lib/database.types').Database>;
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession?.user) {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        
        if (supabaseUser) {
          const userData: User = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            role: (supabaseUser.user_metadata?.role as UserRole) || 'patient',
            name: supabaseUser.user_metadata?.name as string || supabaseUser.email?.split('@')[0],
          };
          setUser(userData);
          setUserRole(userData.role);
        }
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          role: (session.user.user_metadata?.role as UserRole) || 'patient',
          name: session.user.user_metadata?.name as string || session.user.email?.split('@')[0],
        };
        setUser(userData);
        setUserRole(userData.role);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      const userData: User = {
        id: data.user.id,
        email: data.user.email || '',
        role: (data.user.user_metadata?.role as UserRole) || 'patient',
        name: data.user.user_metadata?.name as string || data.user.email?.split('@')[0],
      };
      setUser(userData);
      setUserRole(userData.role);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ supabase, user, session, loading, signIn, signOut, userRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useSession() {
  const { session, loading } = useAuth();
  return { session, loading };
}
