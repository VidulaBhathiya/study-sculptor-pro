import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "user" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  hasTakenQuiz: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTakenQuiz, setHasTakenQuiz] = useState(false);
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    // Check for admin role first, fallback to user
    const roles = (data || []).map((r: any) => r.role);
    setRole(roles.includes("admin") ? "admin" : "user");
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("has_taken_quiz")
      .eq("user_id", userId)
      .maybeSingle();
    setHasTakenQuiz(data?.has_taken_quiz || false);
  };

  const loadUserData = async (userId: string) => {
    // Prevent duplicate fetches for the same user, but never keep loading stuck
    if (lastFetchedUserId.current === userId) {
      setLoading(false);
      return;
    }

    lastFetchedUserId.current = userId;

    try {
      await Promise.allSettled([
        fetchUserRole(userId),
        fetchProfile(userId),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let isActive = true;
    const safetyTimer = setTimeout(() => {
      if (isActive) setLoading(false);
    }, 10000);

    const applySession = async (nextSession: Session | null, event?: string) => {
      if (!isActive) return;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        lastFetchedUserId.current = null;
        setRole(null);
        setHasTakenQuiz(false);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN") {
        lastFetchedUserId.current = null;
      }

      if (lastFetchedUserId.current !== nextUser.id) {
        setLoading(true);
      }

      await loadUserData(nextUser.id);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void applySession(nextSession, event);
    });

    void supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        await applySession(session, "INITIAL_SESSION");
      })
      .catch(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, hasTakenQuiz, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe defaults when rendered outside AuthProvider (e.g. error recovery)
    return {
      user: null,
      session: null,
      role: null,
      loading: true,
      hasTakenQuiz: false,
      signUp: async () => ({ error: new Error("Not initialized") }),
      signIn: async () => ({ error: new Error("Not initialized") }),
      signOut: async () => {},
      refreshProfile: async () => {},
    } as AuthContextType;
  }
  return context;
}
