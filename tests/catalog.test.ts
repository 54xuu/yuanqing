import { describe, it, expect, afterEach } from 'vitest';
import {
  createUser,
  deleteUser,
  createApiKey,
  deleteApiKey,
  assertSafeSkillFilePath,
  assertResourceName,
  listSkills,
  getSkillWithFiles,
  upsertSkill,
  deleteSkill,
  listMcpConfigs,
  getMcpConfig,
  upsertMcpConfig,
  deleteMcpConfig,
  sanitizeMcpConfigJson,
} from '../lib/db';
import {
  handleListSkills,
  handleUploadSkill,
  handleDownloadSkill,
  handleDeleteSkill,
  handleListMcp,
  handleUploadMcp,
  handleDownloadMcp,
  handleDeleteMcp,
} from '../mcp-server/index';

const createdUserIds: string[] = [];
const createdApiKeyIds: string[] = [];

afterEach(() => {
  for (const id of createdApiKeyIds.splice(0)) {
    deleteApiKey(id);
  }
  for (const id of createdUserIds.splice(0)) {
    deleteUser(id);
  }
});

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeUser(prefix: string) {
  const username = `${prefix}-${randomId()}`;
  const user = createUser(username, 'test-password-ok');
  createdUserIds.push(user.id);
  return user;
}

describe('assertSafeSkillFilePath', () => {
  it('accepts relative nested paths', () => {
    expect(assertSafeSkillFilePath('SKILL.md')).toBe('SKILL.md');
    expect(assertSafeSkillFilePath('scripts/run.sh')).toBe('scripts/run.sh');
  });

  it('rejects path traversal and absolute paths', () => {
    expect(() => assertSafeSkillFilePath('../etc/passwd')).toThrow(/unsafe/);
    expect(() => assertSafeSkillFilePath('/etc/passwd')).toThrow(/unsafe/);
    expect(() => assertSafeSkillFilePath('~/secret')).toThrow(/unsafe/);
    expect(() => assertSafeSkillFilePath('a/../../b')).toThrow(/unsafe/);
    expect(() => assertSafeSkillFilePath('')).toThrow(/empty/);
  });
});

describe('assertResourceName', () => {
  it('accepts kebab-case names', () => {
    expect(assertResourceName('yuanqing-recall-memory')).toBe(
      'yuanqing-recall-memory'
    );
  });

  it('rejects invalid names', () => {
    expect(() => assertResourceName('Foo')).toThrow(/invalid name/);
    expect(() => assertResourceName('a_b')).toThrow(/invalid name/);
    expect(() => assertResourceName('../x')).toThrow(/invalid name/);
  });
});

describe('Skill catalog isolation', () => {
  it('isolates skills per user and supports upload/download/delete', () => {
    const a = makeUser('ska');
    const b = makeUser('skb');

    const upA = upsertSkill(a.id, {
      name: 'my-skill',
      description: 'A skill',
      files: [{ path: 'SKILL.md', content: '# A\n', encoding: 'utf8' }],
    });
    expect('action' in upA && upA.action).toBe('created');

    const upB = upsertSkill(b.id, {
      name: 'my-skill',
      description: 'B skill',
      files: [{ path: 'SKILL.md', content: '# B\n', encoding: 'utf8' }],
    });
    expect('action' in upB && upB.action).toBe('created');

    expect(listSkills(a.id)).toHaveLength(1);
    expect(listSkills(b.id)).toHaveLength(1);
    expect(getSkillWithFiles(a.id, 'my-skill')!.files[0].content).toBe('# A\n');
    expect(getSkillWithFiles(b.id, 'my-skill')!.files[0].content).toBe('# B\n');

    const updated = upsertSkill(a.id, {
      name: 'my-skill',
      description: 'A2',
      files: [
        { path: 'SKILL.md', content: '# A2\n' },
        { path: 'extra.txt', content: 'x' },
      ],
    });
    expect('action' in updated && updated.action).toBe('updated');
    if ('skill' in updated) {
      expect(updated.skill.version).toBe(2);
      expect(updated.skill.files).toHaveLength(2);
    }

    expect(deleteSkill(a.id, 'my-skill')).toEqual({
      action: 'deleted',
      name: 'my-skill',
    });
    expect(getSkillWithFiles(a.id, 'my-skill')).toBeNull();
    expect(getSkillWithFiles(b.id, 'my-skill')).not.toBeNull();
  });

  it('rejects unsafe file paths on upsert', () => {
    const u = makeUser('skbad');
    const bad = upsertSkill(u.id, {
      name: 'bad-skill',
      files: [{ path: '../escape.md', content: 'no' }],
    });
    expect(bad).toEqual(
      expect.objectContaining({ error: expect.stringMatching(/unsafe/) })
    );
  });
});

describe('McpConfig catalog', () => {
  it('sanitizes api-key headers and isolates users', () => {
    const a = makeUser('mcpa');
    const b = makeUser('mcpb');

    const sanitized = sanitizeMcpConfigJson({
      url: 'https://example.com/api/mcp',
      headers: { 'x-api-key': 'yq_secret_plain' },
    });
    expect(JSON.parse(sanitized).headers['x-api-key']).toBe(
      '${YUANQING_API_KEY}'
    );

    const up = upsertMcpConfig(a.id, {
      name: 'yuanqing',
      description: 'cloud',
      config: {
        url: 'https://example.com/api/mcp',
        headers: { 'x-api-key': 'yq_should_not_persist' },
      },
    });
    expect('action' in up && up.action).toBe('created');
    if ('mcp' in up) {
      expect(up.mcp.config).toContain('${YUANQING_API_KEY}');
      expect(up.mcp.config).not.toContain('yq_should_not_persist');
    }

    expect(listMcpConfigs(a.id)).toHaveLength(1);
    expect(listMcpConfigs(b.id)).toHaveLength(0);
    expect(getMcpConfig(b.id, 'yuanqing')).toBeNull();

    expect(deleteMcpConfig(a.id, 'yuanqing')).toEqual({
      action: 'deleted',
      name: 'yuanqing',
    });
    expect(getMcpConfig(a.id, 'yuanqing')).toBeNull();
  });
});

describe('MCP handlers with userId', () => {
  it('requires userId for catalog tools', async () => {
    const missing = await handleListSkills(undefined);
    expect(missing).toEqual(
      expect.objectContaining({ error: expect.stringMatching(/user context/) })
    );
  });

  it('upload → list → download → delete roundtrip for skill and mcp', async () => {
    const user = makeUser('round');
    const key = createApiKey(user.id, 'test');
    createdApiKeyIds.push(key.id);
    const uid = user.id;

    const upSkill = await handleUploadSkill(uid, {
      name: 'round-skill',
      description: 'rt',
      files: [{ path: 'SKILL.md', content: '---\nname: round-skill\n---\n# hi\n' }],
    });
    expect('action' in upSkill).toBe(true);

    const listed = await handleListSkills(uid);
    expect('skills' in listed && listed.count).toBe(1);

    const dl = await handleDownloadSkill(uid, 'round-skill');
    expect('skill' in dl && dl.skill.files[0].path).toBe('SKILL.md');

    const other = makeUser('other');
    const cross = await handleDownloadSkill(other.id, 'round-skill');
    expect(cross).toEqual(
      expect.objectContaining({ error: 'skill not found' })
    );

    await handleDeleteSkill(uid, 'round-skill');
    expect(await handleDownloadSkill(uid, 'round-skill')).toEqual(
      expect.objectContaining({ error: 'skill not found' })
    );

    const upMcp = await handleUploadMcp(uid, {
      name: 'demo-mcp',
      description: 'd',
      config: {
        url: 'https://host/api/mcp',
        headers: { Authorization: 'Bearer secret' },
      },
    });
    expect('action' in upMcp).toBe(true);

    const mcpList = await handleListMcp(uid);
    expect('mcps' in mcpList && mcpList.count).toBe(1);

    const mcpDl = await handleDownloadMcp(uid, 'demo-mcp');
    expect('config' in mcpDl).toBe(true);
    if ('config' in mcpDl) {
      expect(
        (mcpDl.config.headers as Record<string, string>).Authorization
      ).toBe('${YUANQING_API_KEY}');
    }

    await handleDeleteMcp(uid, 'demo-mcp');
    expect(await handleDownloadMcp(uid, 'demo-mcp')).toEqual(
      expect.objectContaining({ error: 'mcp config not found' })
    );
  });
});
