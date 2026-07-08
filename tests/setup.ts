import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolate the test DB to a temp file BEFORE any test imports lib/db.
// The lib/db module reads YUANQING_DB_PATH on first import and caches
// the better-sqlite3 instance in a module-level variable, so this
// must run prior to the first import.
const tmpDir = mkdtempSync(join(tmpdir(), 'yuanqing-test-'));
process.env.YUANQING_DB_PATH = join(tmpDir, 'test.db');

// Guard the MCP server's stdio auto-connect IIFE so importing the
// module in tests does not try to grab stdin/stdout. Vitest sets
// process.env.VITEST='true' automatically; the mcp-server module
// checks this flag itself.
