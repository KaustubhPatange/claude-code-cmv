import { error as displayError } from './display.js';

export class CmvError extends Error {
  constructor(
    public userMessage: string,
    message?: string
  ) {
    super(message || userMessage);
    this.name = 'CmvError';
  }
}

export class SessionNotFoundError extends CmvError {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found.`, `Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SnapshotNotFoundError extends CmvError {
  constructor(name: string) {
    super(`Snapshot "${name}" not found.`, `Snapshot not found: ${name}`);
    this.name = 'SnapshotNotFoundError';
  }
}

export class ClaudeCliNotFoundError extends CmvError {
  constructor() {
    super(
      'Claude CLI not found. Set path with: cmv config claude_cli_path <path>',
      'Claude CLI not found in PATH'
    );
    this.name = 'ClaudeCliNotFoundError';
  }
}

export class ClaudeStorageNotFoundError extends CmvError {
  constructor() {
    super(
      'Claude Code not found. Is it installed? Expected ~/.claude/ directory.',
      'Claude storage directory not found'
    );
    this.name = 'ClaudeStorageNotFoundError';
  }
}

export class NoSessionsError extends CmvError {
  constructor() {
    super(
      'No sessions found. Start a Claude Code session first.',
      'No Claude sessions found'
    );
    this.name = 'NoSessionsError';
  }
}

/**
 * Global error handler for CLI commands.
 * Shows userMessage to user; full stack only with CMV_DEBUG=1.
 */
export function handleError(err: unknown): never {
  if (err instanceof CmvError) {
    displayError(err.userMessage);
  } else if (err instanceof Error) {
    displayError(err.message);
  } else {
    displayError(String(err));
  }

  if (process.env['CMV_DEBUG'] === '1' && err instanceof Error) {
    console.error('\nDebug stack trace:');
    console.error(err.stack);
  }

  process.exit(1);
}
