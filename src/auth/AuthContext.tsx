import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { ensureUserProfile, profileToAuthUser, type UserProfile } from "@/lib/social";

type AuthUser = {
  uid: string;
  id: string;
  friendId: string;
  name: string;
  email: string;
  picture?: string;
  emailVerified: boolean;
  provider: "google" | "email";
};

type EmailAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    id: user.uid,
    friendId: `UID-${user.uid.slice(0, 8).toUpperCase()}`,
    name: user.displayName || user.email || "匿名旅者",
    email: user.email || "",
    picture: user.photoURL || undefined,
    emailVerified: user.emailVerified,
    provider: user.providerData[0]?.providerId === "google.com" ? "google" : "email",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const profile: UserProfile = await ensureUserProfile(firebaseUser);

        if (active) {
          setUser({
            ...profileToAuthUser(profile),
            emailVerified: firebaseUser.emailVerified,
          });
        }
      } catch {
        if (active) {
          setUser(mapFirebaseUser(firebaseUser));
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("請輸入名稱。");
    }

    if (!email.trim() || !password) {
      throw new Error("請填完整電子郵件與密碼。");
    }

    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    await updateProfile(credential.user, { displayName: trimmedName });
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  };

  const logout = async () => {
    await signOut(firebaseAuth);
  };

  const refreshUserProfile = async () => {
    const firebaseUser = firebaseAuth.currentUser;

    if (!firebaseUser) {
      setUser(null);
      return;
    }

    const profile = await ensureUserProfile(firebaseUser);
    setUser({
      ...profileToAuthUser(profile),
      emailVerified: firebaseUser.emailVerified,
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      resetPassword,
      logout,
      refreshUserProfile,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
