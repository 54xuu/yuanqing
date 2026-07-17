"use client";

import {
  Table,
  Tag,
  Typography,
  Card,
  Select,
  Button,
  Space,
  message,
  Popconfirm,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

type MemoryRow = {
  id: string;
  title: string;
  mem_scope: string;
  mem_tool: string | null;
  mem_project: string | null;
  updated_at: string;
};

type AliasGroup = {
  scope: "project" | "tool";
  group_key: string;
  names: string[];
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<AliasGroup[]>([]);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [aliasLoading, setAliasLoading] = useState(false);
  const [linkScope, setLinkScope] = useState<"project" | "tool">("project");
  const [linkNames, setLinkNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAliases = useCallback(async () => {
    setAliasLoading(true);
    try {
      const res = await fetch("/api/memories/aliases");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
        setProjectNames(data.projectNames ?? []);
        setToolNames(data.toolNames ?? []);
      }
    } finally {
      setAliasLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemories();
    loadAliases();
  }, [loadMemories, loadAliases]);

  const nameOptions = useMemo(() => {
    const source = linkScope === "project" ? projectNames : toolNames;
    return source.map((n) => ({ label: n, value: n }));
  }, [linkScope, projectNames, toolNames]);

  const scopeTag = (scope: string) => {
    if (scope === "global") return <Tag color="blue">全局</Tag>;
    if (scope === "tool") return <Tag color="green">工具</Tag>;
    if (scope === "project") return <Tag color="orange">项目</Tag>;
    return <Tag>{scope}</Tag>;
  };

  const handleLink = async () => {
    if (linkNames.length < 2) {
      message.warning("请至少选择两个名字");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/memories/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: linkScope, names: linkNames }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "合并失败");
        return;
      }
      message.success("已合并为同一组");
      setLinkNames([]);
      await loadAliases();
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (scope: "project" | "tool", name: string) => {
    const res = await fetch(
      `/api/memories/aliases?scope=${encodeURIComponent(scope)}&name=${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      message.error(data.error || "移出失败");
      return;
    }
    message.success(`已移出「${name}」`);
    await loadAliases();
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>记忆管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        位于「全局记忆 / 工具记忆 / 项目记忆」目录下的笔记均会被 recall_memory 召回。
        同一项目/工具的多个目录名可合并为别名组，任一名字召回时返回该组全部记忆。
      </Typography.Paragraph>

      <Card
        title="记忆别名（同一项目/工具的多个目录名）"
        style={{ marginBottom: 24 }}
        loading={aliasLoading}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Space wrap>
            <Select
              value={linkScope}
              style={{ width: 120 }}
              onChange={(v) => {
                setLinkScope(v);
                setLinkNames([]);
              }}
              options={[
                { label: "项目", value: "project" },
                { label: "工具", value: "tool" },
              ]}
            />
            <Select
              mode="tags"
              style={{ minWidth: 320 }}
              placeholder="选择或输入多个名字"
              value={linkNames}
              onChange={setLinkNames}
              options={nameOptions}
              tokenSeparators={[","]}
            />
            <Button type="primary" loading={saving} onClick={handleLink}>
              合并为一组
            </Button>
          </Space>

          {groups.length === 0 ? (
            <Typography.Text type="secondary">暂无别名分组</Typography.Text>
          ) : (
            groups.map((g) => (
              <div key={`${g.scope}-${g.group_key}`}>
                {scopeTag(g.scope)}
                <Space wrap size={[4, 8]} style={{ marginLeft: 8 }}>
                  {g.names.map((name) => (
                    <Tag key={name}>
                      {name}
                      <Popconfirm
                        title={`将「${name}」移出该组？`}
                        onConfirm={() => handleUnlink(g.scope, name)}
                      >
                        <Button
                          type="link"
                          size="small"
                          danger
                          style={{ padding: "0 4px", height: "auto" }}
                        >
                          移出
                        </Button>
                      </Popconfirm>
                    </Tag>
                  ))}
                </Space>
              </div>
            ))
          )}
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={memories}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "标题", dataIndex: "title", key: "title" },
            {
              title: "层级",
              dataIndex: "mem_scope",
              key: "mem_scope",
              render: (v) => scopeTag(v),
            },
            {
              title: "工具",
              dataIndex: "mem_tool",
              key: "mem_tool",
              render: (v) => v || "—",
            },
            {
              title: "项目",
              dataIndex: "mem_project",
              key: "mem_project",
              render: (v) => v || "—",
            },
            { title: "更新时间", dataIndex: "updated_at", key: "updated_at" },
          ]}
        />
      </Card>
    </div>
  );
}
