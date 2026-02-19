import * as readline from 'node:readline';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import type { TrimMetrics } from '../types/index.js';

const STUB_THRESHOLD = 500;

/**
 * Trim a JSONL session file: strip bloat, keep conversation.
 *
 * Rules:
 *   1. file-history-snapshot entries → skip entirely
 *   2. tool_result content > 500 chars → stub with summary
 *   3. thinking blocks → remove entirely (signature is required by API)
 *   4. Everything else → preserved verbatim
 */
export async function trimJsonl(
  sourcePath: string,
  destPath: string
): Promise<TrimMetrics> {
  const metrics: TrimMetrics = {
    originalBytes: 0,
    trimmedBytes: 0,
    toolResultsStubbed: 0,
    signaturesStripped: 0,
    fileHistoryRemoved: 0,
    userMessages: 0,
    assistantResponses: 0,
    toolUseRequests: 0,
  };

  const stat = await fs.stat(sourcePath);
  metrics.originalBytes = stat.size;

  const fileStream = createReadStream(sourcePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const writer = createWriteStream(destPath, { encoding: 'utf-8' });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      writer.write(line + '\n');
      continue;
    }

    // Rule 1: Skip file-history-snapshot entries
    if (parsed.type === 'file-history-snapshot') {
      metrics.fileHistoryRemoved++;
      continue;
    }

    // Count message types (prefer role — assistant responses have type:"message")
    const role = parsed.role || parsed.type;
    if (role === 'user' || role === 'human') {
      metrics.userMessages++;
    }
    if (role === 'assistant') {
      metrics.assistantResponses++;
    }

    // Process message.content array
    if (Array.isArray(parsed.message?.content)) {
      for (const block of parsed.message.content) {
        // Rule 2: Stub large tool results
        if (block.type === 'tool_result' && Array.isArray(block.content)) {
          const totalLen = block.content
            .filter((c: any) => c.type === 'text')
            .reduce((sum: number, c: any) => sum + (c.text?.length || 0), 0);

          if (totalLen > STUB_THRESHOLD) {
            metrics.toolResultsStubbed++;
            block.content = [{ type: 'text', text: `[Trimmed tool result: ~${totalLen} chars]` }];
          }
        }

        // Rule 2b: Stub large tool result string content
        if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > STUB_THRESHOLD) {
          metrics.toolResultsStubbed++;
          const len = block.content.length;
          block.content = `[Trimmed tool result: ~${len} chars]`;
        }

        // Count tool_use requests
        if (block.type === 'tool_use') {
          metrics.toolUseRequests++;
        }
      }

      // Rule 3: Remove thinking blocks entirely (API requires signature field)
      const thinkingCount = parsed.message.content.filter((b: any) => b.type === 'thinking').length;
      if (thinkingCount > 0) {
        metrics.signaturesStripped += thinkingCount;
        parsed.message.content = parsed.message.content.filter((b: any) => b.type !== 'thinking');
      }
    }

    // Handle top-level content array (alternative JSONL format)
    if (Array.isArray(parsed.content)) {
      for (const block of parsed.content) {
        if (block.type === 'tool_result' && Array.isArray(block.content)) {
          const totalLen = block.content
            .filter((c: any) => c.type === 'text')
            .reduce((sum: number, c: any) => sum + (c.text?.length || 0), 0);

          if (totalLen > STUB_THRESHOLD) {
            metrics.toolResultsStubbed++;
            block.content = [{ type: 'text', text: `[Trimmed tool result: ~${totalLen} chars]` }];
          }
        }

        if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > STUB_THRESHOLD) {
          metrics.toolResultsStubbed++;
          const len = block.content.length;
          block.content = `[Trimmed tool result: ~${len} chars]`;
        }

        if (block.type === 'tool_use') {
          metrics.toolUseRequests++;
        }
      }

      // Rule 3: Remove thinking blocks entirely (API requires signature field)
      const thinkingCount = parsed.content.filter((b: any) => b.type === 'thinking').length;
      if (thinkingCount > 0) {
        metrics.signaturesStripped += thinkingCount;
        parsed.content = parsed.content.filter((b: any) => b.type !== 'thinking');
      }
    }

    // Strip API usage data — it reflects the original pre-trim context size
    // and would cause the analyzer to report stale (too-high) token counts.
    // Without usage data the analyzer falls back to its content-based heuristic,
    // which correctly reflects the trimmed content.
    if (parsed.message?.usage) delete parsed.message.usage;
    if (parsed.usage) delete parsed.usage;

    writer.write(JSON.stringify(parsed) + '\n');
  }

  rl.close();

  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.on('error', reject);
  });

  const destStat = await fs.stat(destPath);
  metrics.trimmedBytes = destStat.size;

  return metrics;
}
