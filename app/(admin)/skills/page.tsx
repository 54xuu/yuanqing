"use client";

import { Button, message, Modal, Table, Typography, Card, Space, Tag } from "antd";
import { CopyOutlined, DeleteOutlined, DownloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { copyTextWithFallback } from "@/lib/copyToClipboard";

type SkillRow = {
  id: string;
  name: string;
  description: string;
  version: number;
  updated_at: string;
  file_count: number;
};

type SkillFile = {
  path: string;
  encoding: string;
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFiles, setDetailFiles] = useState<SkillFile[]>([]);
  const [detailName, setDetailName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadUrl = (name: string) =>
    `${window.location.origin}/api/skills/${encodeURIComponent(name)}/download`;

  const copyLink = (name: string) => {
    copyTextWithFallback(downloadUrl(name), {
      onSuccess: () => message.success("下载链接已复制"),
      onFail: () => message.warning("已打开手动复制窗口"),
    });
  };

  const showDetail = async (name: string) => {
    const res = await fetch(`/api/skills/${encodeURIComponent(name)}`);
    if (!res.ok) {
      message.error("加载失败");
      return;
    }
    const data = await res.json();
    setDetailName(name);
    setDetailFiles(data.skill?.files ?? []);
    setDetailOpen(true);
  };

  const deleteSkill = async (name: string) => {
    Modal.confirm({
      title: `删除 Skill「${name}」？`,
      okType: "danger",
      onOk: async () => {
        const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          message.error("删除失败");
          return;
        }
        message.success("已删除");
        await load();
      },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>Skill 管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        云端 Skill 目录。可通过 MCP download_skill / upload_skill 同步到本地（Cursor:
        ~/.cursor/skills；OpenCode: ~/.config/opencode/skills）。
      </Typography.Paragraph>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={skills}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "名称", dataIndex: "name", key: "name" },
            {
              title: "版本",
              dataIndex: "version",
              key: "version",
              render: (v) => <Tag>v{v}</Tag>,
            },
            {
              title: "文件数",
              dataIndex: "file_count",
              key: "file_count",
            },
            {
              title: "描述",
              dataIndex: "description",
              key: "description",
              ellipsis: true,
              render: (v) => v || "—",
            },
            { title: "更新时间", dataIndex: "updated_at", key: "updated_at" },
            {
              title: "操作",
              key: "actions",
              render: (_, r) => (
                <Space wrap>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    href={downloadUrl(r.name)}
                    target="_blank"
                  >
                    下载
                  </Button>
                  <Button type="link" icon={<CopyOutlined />} onClick={() => copyLink(r.name)}>
                    复制链接
                  </Button>
                  <Button type="link" onClick={() => showDetail(r.name)}>
                    查看文件
                  </Button>
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteSkill(r.name)}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={`Skill 文件：${detailName}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
      >
        <Table
          size="small"
          rowKey="path"
          dataSource={detailFiles}
          pagination={false}
          columns={[
            { title: "路径", dataIndex: "path" },
            { title: "编码", dataIndex: "encoding", width: 80 },
          ]}
        />
      </Modal>
    </div>
  );
}
