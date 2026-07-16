"use client";

import { Table, Tag, Typography, Card } from "antd";
import { useCallback, useEffect, useState } from "react";

type MemoryRow = {
  id: string;
  title: string;
  mem_scope: string;
  mem_tool: string | null;
  mem_project: string | null;
  updated_at: string;
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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

  useEffect(() => {
    load();
  }, [load]);

  const scopeTag = (scope: string) => {
    if (scope === "global") return <Tag color="blue">全局</Tag>;
    if (scope === "tool") return <Tag color="green">工具</Tag>;
    if (scope === "project") return <Tag color="orange">项目</Tag>;
    return <Tag>{scope}</Tag>;
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>记忆管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        位于「全局记忆 / 工具记忆 / 项目记忆」目录下的笔记均会被 recall_memory 召回。
      </Typography.Paragraph>
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
