"use client";

import { Button, Input, message, Table, Typography, Card, Space, Tag } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { copyTextWithFallback } from "@/lib/copyToClipboard";
import { useRouter } from "next/navigation";

type PublicUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
};

type ApiKey = {
  id: string;
  key: string;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [userKeys, setUserKeys] = useState<Record<string, ApiKey[]>>({});
  const [createdKeys, setCreatedKeys] = useState<Record<string, string>>({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user?.role !== "admin") {
        router.replace("/");
        return;
      }
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users ?? []);
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
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = async () => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      message.error(data?.error || "创建失败");
      return;
    }
    setUsername("");
    setPassword("");
    message.success("用户已创建");
    await load();
  };

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      message.error(data?.error || "删除失败");
      return;
    }
    await load();
  };

  const createKeyForUser = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      message.error(data?.error || "创建密钥失败");
      return;
    }
    setCreatedKeys((p) => ({ ...p, [userId]: data.apiKey.key }));
    await load();
  };

  const copy = (text: string) => {
    copyTextWithFallback(text, {
      onSuccess: () => message.success("已复制"),
      onFail: () => message.warning("已打开手动复制窗口"),
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>用户管理</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input.Password placeholder="密码（≥8位）" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="primary" onClick={createUser}>
            创建用户
          </Button>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={users}
          columns={[
            { title: "用户名", dataIndex: "username" },
            {
              title: "角色",
              dataIndex: "role",
              render: (v) => (v === "admin" ? <Tag color="red">admin</Tag> : <Tag>user</Tag>),
            },
            { title: "创建时间", dataIndex: "created_at" },
            {
              title: "API 密钥",
              render: (_, u) => (
                <div>
                  {createdKeys[u.id] && (
                    <div style={{ marginBottom: 8 }}>
                      <code>{createdKeys[u.id]}</code>
                      <Button type="link" icon={<CopyOutlined />} onClick={() => copy(createdKeys[u.id])} />
                    </div>
                  )}
                  {(userKeys[u.id] ?? []).map((k) => (
                    <div key={k.id}>
                      <code>{k.key}</code>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              title: "操作",
              render: (_, u) => (
                <Space>
                  <Button type="link" onClick={() => createKeyForUser(u.id)}>
                    创建密钥
                  </Button>
                  <Button type="link" danger onClick={() => deleteUser(u.id)}>
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
