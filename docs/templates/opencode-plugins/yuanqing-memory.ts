/**
 * OpenCode 全局插件：yuanqing 记忆自动触发（硬触发）
 *
 * 复制到：~/.config/opencode/plugins/yuanqing-memory.ts
 * Windows：C:\Users\xujia\.config\opencode\plugins\yuanqing-memory.ts
 *
 * 命中关键词后向消息注入指令，促使 Agent 调用 yuanqing MCP 的 recall_memory / save_memory。
 * 「上下文里没有该信息」类软触发由 AGENTS.md 负责，本插件不处理。
 *
 * 注意：push 到 output.parts 的 TextPart 必须含 id（prt_ 前缀）、sessionID、messageID、synthetic:true，
 * 否则 opencode 会 Zod 校验失败并报 "Failed to send prompt / Unexpected server error"。
 */

const TOOL = "opencode";

/** opencode chat.message 的 Part 读模型，push 时必须带齐字段 */
type TextPart = {
  id?: string;
  sessionID?: string;
  messageID?: string;
  type: "text";
  text: string;
  synthetic?: boolean;
};

type RecallScopeHint = "project" | "tool" | "global" | "all";

const RECALL_PATTERNS: Array<{ scope: RecallScopeHint; pattern: RegExp }> = [
  { scope: "project", pattern: /回忆项目记忆|获取项目记忆/ },
  { scope: "tool", pattern: /回忆工具记忆|获取工具记忆/ },
  { scope: "global", pattern: /回忆全局记忆|获取全局记忆/ },
  {
    scope: "all",
    pattern: /回忆记忆|获取记忆|召回记忆|加载记忆|recall_memory/i,
  },
];

const SAVE_PATTERN =
  /永久记住|需要永久记住|保存记忆|以后都要|别忘了|save_memory|(?:^|[\s，,：:])记住(?:[\s，,：:]|$)/;

function getMessageText(parts: TextPart[]): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getProjectName(directory: string | undefined): string {
  if (!directory) return "";
  const segments = directory.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

function detectRecallScope(text: string): RecallScopeHint | null {
  for (const { scope, pattern } of RECALL_PATTERNS) {
    if (pattern.test(text)) return scope;
  }
  return null;
}

function buildRecallInstruction(scope: RecallScopeHint, project: string): string {
  const projectArg = project ? `"${project}"` : '""';
  const base = `recall_memory({ tool: "${TOOL}", project: ${projectArg}`;

  switch (scope) {
    case "project":
      return [
        "[yuanqing-memory 硬触发：回忆/获取项目记忆]",
        "本条用户消息命中关键词。请立即调用 yuanqing MCP 工具 recall_memory，优先关注 project 层：",
        `${base}, query: "项目" })`,
        "将返回的 project 记忆纳入上下文后再回复用户。",
      ].join("\n");
    case "tool":
      return [
        "[yuanqing-memory 硬触发：回忆/获取工具记忆]",
        "本条用户消息命中关键词。请立即调用 yuanqing MCP 工具 recall_memory，优先关注 tool 层：",
        `${base}, query: "工具" })`,
        "将返回的 tool 记忆纳入上下文后再回复用户。",
      ].join("\n");
    case "global":
      return [
        "[yuanqing-memory 硬触发：回忆/获取全局记忆]",
        "本条用户消息命中关键词。请立即调用 yuanqing MCP 工具 recall_memory，优先关注 global 层：",
        `recall_memory({ tool: "${TOOL}", query: "全局" })`,
        "将返回的 global 记忆纳入上下文后再回复用户。",
      ].join("\n");
    default:
      return [
        "[yuanqing-memory 硬触发：回忆/获取记忆]",
        "本条用户消息命中关键词。请立即调用 yuanqing MCP 工具 recall_memory（全量）：",
        `${base} })`,
        "将返回的 global / tool / project 记忆纳入上下文后再回复用户。",
      ].join("\n");
  }
}

function createSyntheticTextPart(
  input: { sessionID?: string; messageID?: string },
  output: { parts: TextPart[]; message?: { id?: string } },
  text: string
): TextPart | null {
  const existing = output.parts.find(
    (part) =>
      part.type === "text" &&
      typeof part.sessionID === "string" &&
      typeof part.messageID === "string"
  );

  const sessionID = existing?.sessionID ?? input.sessionID;
  const messageID =
    existing?.messageID ?? input.messageID ?? output.message?.id;

  if (!sessionID || !messageID) return null;

  return {
    id: `prt_yuanqing_memory_${Date.now()}`,
    sessionID,
    messageID,
    type: "text",
    text,
    synthetic: true,
  };
}

function buildSaveInstruction(project: string): string {
  const projectLine = project
    ? `- scope=project：只影响当前仓库 → project: "${project}"`
    : "- scope=project：只影响当前仓库 → project 填当前仓库目录名";

  return [
    "[yuanqing-memory 硬触发：保存记忆]",
    "本条用户消息命中保存关键词。请立即调用 yuanqing MCP 工具 save_memory（source_app: \"opencode\"），不要只写本地文件。",
    "按内容判定 scope：",
    "- scope=global：与工具、项目都无关的通用偏好",
    "- scope=tool：只影响 OpenCode 等 Agent 应用 → tool: \"opencode\"",
    projectLine,
    "从用户消息提取 title 与 content；修改已有记忆时保持 title/scope 不变再覆盖 content。",
  ].join("\n");
}

export const YuanqingMemoryPlugin = async ({
  directory,
}: {
  directory?: string;
}) => {
  const project = getProjectName(directory);

  return {
    "chat.message": async (
      input: { sessionID?: string; messageID?: string; agent?: string },
      output: { parts?: TextPart[]; message?: { id?: string } }
    ) => {
      try {
        if (!Array.isArray(output.parts)) return;

        const text = getMessageText(output.parts);
        if (!text) return;

        let instruction: string | null = null;

        // 保存优先：用户可能同时提到「记住」与「回忆」
        if (SAVE_PATTERN.test(text)) {
          instruction = buildSaveInstruction(project);
        } else {
          const recallScope = detectRecallScope(text);
          if (recallScope) {
            instruction = buildRecallInstruction(recallScope, project);
          }
        }

        if (!instruction) return;

        const part = createSyntheticTextPart(
          input,
          { parts: output.parts, message: output.message },
          instruction
        );
        if (part) output.parts.push(part);
      } catch {
        // 插件失败不应阻断用户发消息
      }
    },
  };
};

export default YuanqingMemoryPlugin;
