"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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

function setTokenCookie(session: CognitoUserSession) {
  const token = session.getIdToken().getJwtToken();
  const maxAge = 60 * 60; // 1 hour
  document.cookie = `auth-token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie = "auth-token=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  // Check existing session on mount
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
  }, []);

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
