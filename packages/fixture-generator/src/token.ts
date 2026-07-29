/**
 * Personal Access Token storage. The token is cached as JSON in
 * `~/.airtable-testing` (mode 0600) so the CLI only asks once per machine.
 * Override precedence: `--token` flag > `AIRTABLE_TOKEN` env var > cache.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export function tokenCachePath(): string {
    return path.join(os.homedir(), '.airtable-testing');
}

export function readCachedToken(): string | null {
    try {
        const raw = fs.readFileSync(tokenCachePath(), 'utf8');
        const parsed = JSON.parse(raw);
        return typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null;
    } catch {
        return null;
    }
}

export function writeCachedToken(token: string): void {
    fs.writeFileSync(tokenCachePath(), `${JSON.stringify({token}, null, 4)}\n`, {mode: 0o600});
}

export function clearCachedToken(): void {
    try {
        fs.unlinkSync(tokenCachePath());
    } catch {
        // Already absent.
    }
}

export interface ResolveTokenOptions {
    /** Value of the --token flag, if given. NEVER written to the cache (CI use). */
    tokenFlag?: string;
    /** Whether --reset-token was given: clears the cache before resolving. */
    resetToken?: boolean;
    /** Value of the AIRTABLE_TOKEN env var, if set. NEVER written to the cache. */
    envToken?: string;
    /** Interactive prompt, injected so the CLI wiring stays testable. */
    promptAsync: () => Promise<string>;
    /** Progress logger (defaults to console.log). */
    log?: (message: string) => void;
}

/**
 * Resolve the Personal Access Token. Precedence: `--token` flag, then the
 * `AIRTABLE_TOKEN` env var, then the cache file, then an interactive prompt.
 *
 * Only an interactively entered token is written to the cache — tokens
 * supplied via flag or environment are used for this run only, so CI
 * secrets never land on disk.
 */
export async function resolveTokenAsync(options: ResolveTokenOptions): Promise<string> {
    const log = options.log ?? console.log;

    if (options.resetToken) {
        clearCachedToken();
    }
    if (options.tokenFlag) {
        return options.tokenFlag;
    }
    if (options.envToken) {
        return options.envToken;
    }
    const cached = readCachedToken();
    if (cached) {
        return cached;
    }
    const entered = await options.promptAsync();
    if (!entered) {
        throw new Error('A Personal Access Token is required.');
    }
    writeCachedToken(entered);
    log(`Token saved to ${tokenCachePath()}`);
    return entered;
}
