---
name: yuanqing-bump-version
description: >-
  Bump yuanqing package.json version before Docker/SWR tagging so the logo
  shows the matching vX.Y. Use when releasing, tagging images, pushing to SWR,
  or upgrading Sealos. Triggers: 打 tag、发版、推 SWR、升 Sealos、改版本号、logo 版本。
---

# 发布前同步版本号

UI logo 旁版本来自 `package.json` → `lib/version.ts` → `APP_VERSION_LABEL`（`v` + version）。

## 步骤

1. 确认目标 tag（如 `v1.8`）
2. 修改 `package.json` 的 `"version"` 为 `"1.8"`（不要带 `v`）
3. **不要**在 `app/page.tsx` / `app/login/page.tsx` 写死 `v1.x`
4. 再构建：`DOCKER_BUILDKIT=0 docker build -t yuanqing:v1.8 .`
5. 推 SWR / 升 Sealos

漏改 `package.json` 会出现「功能已升、logo 仍是旧版」。
