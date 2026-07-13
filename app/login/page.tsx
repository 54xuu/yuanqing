"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_VERSION_LABEL } from "@/lib/version";

type PublicUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "登录失败");
        return;
      }
      const user = data.user as PublicUser;
      const target =
        next || (user.role === "admin" ? "/admin" : "/");
      router.replace(target);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-title-container"><div className="auth-title">源清 YuanQing 登录</div><div className="auth-version">{APP_VERSION_LABEL}</div></div>
        <div className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              className="auth-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
          <div className="auth-error">{error}</div>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <LoginForm />
    </Suspense>
  );
}
