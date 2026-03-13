"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserSession } from "amazon-cognito-identity-js";
import { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } from "./cognito";

let _userPool: CognitoUserPool | null = null;
function getUserPool(): CognitoUserPool {
  if (!_userPool) {
    if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
      throw new Error(
        `Cognito設定が不足しています: UserPoolId=${COGNITO_USER_POOL_ID ? "OK" : "未設定"}, ClientId=${COGNITO_CLIENT_ID ? "OK" : "未設定"}。Amplify環境変数を確認してください。`
      );
    }
    _userPool = new CognitoUserPool({
      UserPoolId: COGNITO_USER_POOL_ID,
      ClientId: COGNITO_CLIENT_ID,
    });
  }
  return _userPool;
}

type AuthUser = {
  username: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; newPasswordRequired?: boolean }>;
  completeNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  completeNewPassword: async () => ({ success: false }),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function parseUser(session: CognitoUserSession): AuthUser {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();
  const groups: string[] = payload["cognito:groups"] || [];
  return {
    username: payload["cognito:username"] || "",
    email: payload.email || "",
    groups,
    isAdmin: groups.includes("admin"),
  };
}

const COOKIE_NAME = "sonic-eye-token";

function setTokenCookie(session: CognitoUserSession) {
  const token = session.getIdToken().getJwtToken();
  // Cookie自体は7日間保持（JWT検証はサーバー側で行う）
  const maxAge = 7 * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
  // Clear legacy cookie if present
  document.cookie = "auth-token=; path=/; max-age=0";
}

function clearTokenCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  document.cookie = "auth-token=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh session: getSession() automatically uses the refresh token
  const refreshSession = useCallback(() => {
    try {
      const currentUser = getUserPool().getCurrentUser();
      if (!currentUser) return;
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          // Refresh token expired — force re-login
          setUser(null);
          clearTokenCookie();
          return;
        }
        setUser(parseUser(session));
        setTokenCookie(session);
      });
    } catch {
      // ignore
    }
  }, []);

  // Check existing session on mount + set up periodic refresh
  useEffect(() => {
    try {
      const currentUser = getUserPool().getCurrentUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          setLoading(false);
          return;
        }
        setUser(parseUser(session));
        setTokenCookie(session);
        setLoading(false);
      });
    } catch (e) {
      console.error("Auth initialization failed:", e);
      setLoading(false);
    }

    // Refresh token every 45 minutes (ID token expires in 60 min)
    refreshTimer.current = setInterval(refreshSession, 45 * 60 * 1000);

    // Refresh when tab becomes visible again (handles sleep/background)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string; newPasswordRequired?: boolean }> => {
    return new Promise((resolve) => {
      const cu = new CognitoUser({ Username: username, Pool: getUserPool() });
      const authDetails = new AuthenticationDetails({ Username: username, Password: password });

      cu.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setUser(parseUser(session));
          setTokenCookie(session);
          resolve({ success: true });
        },
        onFailure: (err) => {
          resolve({ success: false, error: err.message || "認証に失敗しました" });
        },
        newPasswordRequired: () => {
          setCognitoUser(cu);
          resolve({ success: false, newPasswordRequired: true });
        },
      });
    });
  }, []);

  const completeNewPassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!cognitoUser) return { success: false, error: "セッションが見つかりません" };
    return new Promise((resolve) => {
      cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (session) => {
          setUser(parseUser(session));
          setTokenCookie(session);
          setCognitoUser(null);
          resolve({ success: true });
        },
        onFailure: (err) => {
          resolve({ success: false, error: err.message || "パスワード変更に失敗しました" });
        },
      });
    });
  }, [cognitoUser]);

  const logout = useCallback(() => {
    const currentUser = getUserPool().getCurrentUser();
    if (currentUser) currentUser.signOut();
    setUser(null);
    clearTokenCookie();
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeNewPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
