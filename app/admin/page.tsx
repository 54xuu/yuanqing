"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PublicUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
};

type ApiKey = {
  id: string;
  user_id: string;
  key: string;
  name: string;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [myKeys, setMyKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [myKeyName, setMyKeyName] = useState("");

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userKeys, setUserKeys] = useState<Record<string, ApiKey[]>>({});
  const [createdKeyForUser, setCreatedKeyForUser] = useState<
    Record<string, string>
  >({});

  const [msg, setMsg] = useState("");
  const isAdmin = me?.role === "admin";

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        router.replace("/login?next=/admin");
        return;
      }
      const data = await res.json();
      setMe(data.user);
    } catch {
      setMsg("加载用户信息失败");
    } finally {
      setMeLoading(false);
    }
  }, [router]);

  const loadMyKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setMyKeys(data.keys ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        // Load each user's keys.
        const byUser: Record<string, ApiKey[]> = {};
        await Promise.all(
          (data.users ?? []).map(async (u: PublicUser) => {
            const r = await fetch(`/api/admin/users/${u.id}/api-keys`);
            if (r.ok) {
              const d = await r.json();
              byUser[u.id] = d.keys ?? [];
            }
          })
        );
        setUserKeys(byUser);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (me) {
      loadMyKeys();
      if (me.role === "admin") loadUsers();
    }
  }, [me, loadMyKeys, loadUsers]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const createMyKey = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: myKeyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "创建密钥失败");
        return;
      }
      setNewKey(data.apiKey.key);
      setMyKeyName("");
      await loadMyKeys();
    } catch {
      setMsg("网络错误");
    }
  };

  const deleteMyKey = async (id: string) => {
    setMsg("");
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setMsg(data?.error || "删除失败");
        return;
      }
      await loadMyKeys();
    } catch {
      setMsg("网络错误");
    }
  };

  const createUser = async () => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "创建用户失败");
        return;
      }
      setNewUsername("");
      setNewPassword("");
      await loadUsers();
    } catch {
      setMsg("网络错误");
    }
  };

  const deleteUser = async (id: string) => {
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "删除用户失败");
        return;
      }
      await loadUsers();
    } catch {
      setMsg("网络错误");
    }
  };

  const createKeyForUser = async (userId: string) => {
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "创建密钥失败");
        return;
      }
      setCreatedKeyForUser((prev) => ({
        ...prev,
        [userId]: data.apiKey.key,
      }));
      await loadUsers();
    } catch {
      setMsg("网络错误");
    }
  };

  const deleteKeyForUser = async (keyId: string) => {
    setMsg("");
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setMsg(data?.error || "删除密钥失败");
        return;
      }
      await loadUsers();
    } catch {
      setMsg("网络错误");
    }
  };

  if (meLoading) {
    return <div className="empty-state">加载中...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>后台管理</h1>
        <div className="admin-nav">
          <span>{me?.username}</span>
          <a href="/">返回知识库</a>
          <button className="link-btn" onClick={logout}>
            退出
          </button>
        </div>
      </div>

      {msg && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* My API Keys */}
      <div className="card">
        <div className="card-title">我的 API 密钥</div>
        {newKey && (
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              新密钥（仅显示一次，请立即复制）：
            </div>
            <div className="key-highlight" data-testid="new-api-key">
              {newKey}
            </div>
          </div>
        )}
        <div className="inline-form">
          <input
            type="text"
            placeholder="密钥名称（可选）"
            value={myKeyName}
            onChange={(e) => setMyKeyName(e.target.value)}
          />
          <button className="small-btn primary" onClick={createMyKey}>
            创建密钥
          </button>
        </div>
        {myKeys.length === 0 ? (
          <div className="muted">暂无密钥</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>API Key</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {myKeys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name || "-"}</td>
                  <td className="mono">{k.key}</td>
                  <td className="muted">{k.created_at}</td>
                  <td>
                    <button
                      className="link-btn danger-btn"
                      onClick={() => deleteMyKey(k.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* User Management (admin only) */}
      {isAdmin && (
        <div className="card">
          <div className="card-title">用户管理</div>
          <div className="inline-form">
            <input
              type="text"
              placeholder="用户名"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="密码"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button className="small-btn primary" onClick={createUser}>
              创建用户
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>API 密钥</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td className="muted">{u.created_at}</td>
                  <td>
                    {createdKeyForUser[u.id] && (
                      <div
                        className="key-highlight"
                        style={{ marginBottom: 8 }}
                        data-testid={`new-key-${u.id}`}
                      >
                        {createdKeyForUser[u.id]}
                      </div>
                    )}
                    <div>
                      {(userKeys[u.id] ?? []).map((k) => (
                        <div key={k.id} className="mono" style={{ marginBottom: 4 }}>
                          {k.key}{" "}
                          <button
                            className="link-btn danger-btn"
                            onClick={() => deleteKeyForUser(k.id)}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      {(userKeys[u.id] ?? []).length === 0 &&
                        !createdKeyForUser[u.id] && (
                          <span className="muted">无</span>
                        )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => createKeyForUser(u.id)}
                      style={{ marginRight: 8 }}
                    >
                      创建密钥
                    </button>
                    {u.id !== me?.id && (
                      <button
                        className="link-btn danger-btn"
                        onClick={() => deleteUser(u.id)}
                      >
                        删除用户
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
