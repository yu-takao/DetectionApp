"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Hexagon, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, completeNewPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      window.location.href = "/";
      return;
    }
    if (result.newPasswordRequired) {
      setNeedsNewPassword(true);
      setLoading(false);
      return;
    }
    setError(result.error || "認証に失敗しました");
    setLoading(false);
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await completeNewPassword(newPassword);
    if (result.success) {
      window.location.href = "/";
      return;
    }
    setError(result.error || "パスワード変更に失敗しました");
    setLoading(false);
  }

  const inputClass =
    "w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors";

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-zinc-900 rounded-2xl mb-3">
            <Hexagon className="text-violet-400" style={{ width: 32, height: 32 }} />
          </div>
          <h1 className="text-lg font-bold text-zinc-800 tracking-tight">Noise Monitor</h1>
          <p className="text-xs text-zinc-400 mt-0.5">異音検出モニタリングシステム</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          {!needsNewPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">パスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                ログイン
              </button>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-zinc-600">初回ログインのためパスワードの変更が必要です</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">新しいパスワード</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8文字以上、大小英数字を含む"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                パスワードを変更してログイン
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
