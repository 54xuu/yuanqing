"use client";

import { useState } from "react";
import { Button, Form, Input, message, Typography, Card } from "antd";

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: values.currentPassword,
          new_password: values.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data?.error || "修改失败");
        return;
      }
      message.success("密码已修改，请重新登录");
      form.resetFields();
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <Typography.Title level={4}>个人设置</Typography.Title>
      <Card title="修改密码">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[{ required: true, message: "请再次输入新密码" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
