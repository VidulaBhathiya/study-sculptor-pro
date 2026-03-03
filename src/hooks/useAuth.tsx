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
      await fetchUserRole(userId);
      await fetchProfile(userId);
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
    let initialized = false;
    const safetyTimer = setTimeout(() => setLoading(false), 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Skip if getSession already handled this user
          if (!initialized) {
            initialized = true;
            return;
          }
          // Reset ref on new sign-in so data reloads
          if (_event === "SIGNED_IN") {
            lastFetchedUserId.current = null;
          }
          await loadUserData(session.user.id);
        } else {
          lastFetchedUserId.current = null;
          setRole(null);
          setHasTakenQuiz(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      initialized = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
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
