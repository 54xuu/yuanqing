"use client";

import { Button, Input, message, Table, Typography, Card, Space } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { copyTextWithFallback } from "@/lib/copyToClipboard";

type ApiKey = {
  id: string;
  key: string;
  name: string;
  created_at: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      message.error(data?.error || "创建失败");
      return;
    }
    setNewKey(data.apiKey.key);
    setName("");
    await load();
  };

  const deleteKey = async (id: string) => {
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      message.error("删除失败");
      return;
    }
    await load();
  };

  const saveName = async (id: string) => {
    const res = await fetch(`/api/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    if (!res.ok) {
      message.error("修改失败");
      return;
    }
    setEditingId(null);
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
      <Typography.Title level={4}>API 密钥</Typography.Title>
      <Typography.Paragraph type="secondary">
        用于 Cursor / OpenCode 等 Agent 通过 HTTP 访问 MCP 端点（/api/mcp）。
      </Typography.Paragraph>
      {newKey && (
        <Card style={{ marginBottom: 16 }} type="inner" title="新密钥（仅显示一次）">
          <Space>
            <code>{newKey}</code>
            <Button icon={<CopyOutlined />} onClick={() => copy(newKey)}>
              复制
            </Button>
          </Space>
        </Card>
      )}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="密钥名称（可选）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 240 }}
          />
          <Button type="primary" onClick={createKey}>
            创建密钥
          </Button>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={keys}
          columns={[
            {
              title: "名称",
              dataIndex: "name",
              render: (v, r) =>
                editingId === r.id ? (
                  <Space>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      size="small"
                    />
                    <Button size="small" type="primary" onClick={() => saveName(r.id)}>
                      保存
                    </Button>
                    <Button size="small" onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                  </Space>
                ) : (
                  v || "—"
                ),
            },
            {
              title: "Key",
              dataIndex: "key",
              render: (v) => (
                <Space>
                  <code>{v}</code>
                  <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copy(v)} />
                </Space>
              ),
            },
            { title: "创建时间", dataIndex: "created_at" },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button type="link" onClick={() => { setEditingId(r.id); setEditingName(r.name); }}>
                    修改
                  </Button>
                  <Button type="link" danger onClick={() => deleteKey(r.id)}>
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
