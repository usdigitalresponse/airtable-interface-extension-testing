import * as fs from 'node:fs';
import * as path from 'node:path';

// os.homedir must be mocked at the module level: babel's import interop hands
// each module its own namespace copy, so jest.spyOn in the test file would
// not affect src/token.ts.
let mockHome: string;
jest.mock('node:os', () => {
    const actual = jest.requireActual('node:os');
    return {...actual, homedir: () => mockHome};
});

import {
    clearCachedToken,
    readCachedToken,
    resolveTokenAsync,
    tokenCachePath,
    writeCachedToken,
} from '../src/token';

describe('token cache', () => {
    beforeEach(() => {
        mockHome = fs.mkdtempSync(path.join(jest.requireActual('node:os').tmpdir(), 'at-fx-'));
    });

    afterEach(() => {
        fs.rmSync(mockHome, {recursive: true, force: true});
    });

    it('round-trips a token through ~/.airtable-testing', () => {
        expect(readCachedToken()).toBeNull();

        writeCachedToken('patFakeToken123');
        expect(tokenCachePath()).toBe(path.join(mockHome, '.airtable-testing'));
        expect(readCachedToken()).toBe('patFakeToken123');

        const stats = fs.statSync(tokenCachePath());
        expect(stats.mode & 0o777).toBe(0o600);
    });

    it('clearCachedToken removes the file and tolerates absence', () => {
        writeCachedToken('patFakeToken123');
        clearCachedToken();
        expect(readCachedToken()).toBeNull();
        expect(() => clearCachedToken()).not.toThrow();
    });

    it('ignores malformed cache files', () => {
        fs.writeFileSync(path.join(mockHome, '.airtable-testing'), 'not json');
        expect(readCachedToken()).toBeNull();
    });
});

describe('resolveTokenAsync', () => {
    beforeEach(() => {
        mockHome = fs.mkdtempSync(path.join(jest.requireActual('node:os').tmpdir(), 'at-fx-'));
    });

    afterEach(() => {
        fs.rmSync(mockHome, {recursive: true, force: true});
    });

    const failingPrompt = () => Promise.reject(new Error('prompt should not be called'));

    it('uses --token without writing the cache file (CI mode)', async () => {
        const token = await resolveTokenAsync({
            tokenFlag: 'patFromFlag',
            promptAsync: failingPrompt,
        });

        expect(token).toBe('patFromFlag');
        expect(fs.existsSync(tokenCachePath())).toBe(false);
        expect(readCachedToken()).toBeNull();
    });

    it('--token does not overwrite an existing cached token', async () => {
        writeCachedToken('patCachedEarlier');

        const token = await resolveTokenAsync({
            tokenFlag: 'patFromFlag',
            promptAsync: failingPrompt,
        });

        expect(token).toBe('patFromFlag');
        expect(readCachedToken()).toBe('patCachedEarlier');
    });

    it('uses AIRTABLE_TOKEN without writing the cache file', async () => {
        const token = await resolveTokenAsync({
            envToken: 'patFromEnv',
            promptAsync: failingPrompt,
        });

        expect(token).toBe('patFromEnv');
        expect(fs.existsSync(tokenCachePath())).toBe(false);
    });

    it('prefers --token over env over cache', async () => {
        writeCachedToken('patCached');

        await expect(
            resolveTokenAsync({
                tokenFlag: 'patFromFlag',
                envToken: 'patFromEnv',
                promptAsync: failingPrompt,
            }),
        ).resolves.toBe('patFromFlag');

        await expect(
            resolveTokenAsync({envToken: 'patFromEnv', promptAsync: failingPrompt}),
        ).resolves.toBe('patFromEnv');

        await expect(resolveTokenAsync({promptAsync: failingPrompt})).resolves.toBe('patCached');
    });

    it('caches only interactively entered tokens', async () => {
        const log = jest.fn();
        const token = await resolveTokenAsync({
            promptAsync: () => Promise.resolve('patTypedIn'),
            log,
        });

        expect(token).toBe('patTypedIn');
        expect(readCachedToken()).toBe('patTypedIn');
        expect(log).toHaveBeenCalledWith(expect.stringContaining('.airtable-testing'));
    });

    it('resetToken clears the cache before resolving', async () => {
        writeCachedToken('patStale');
        const token = await resolveTokenAsync({
            resetToken: true,
            promptAsync: () => Promise.resolve('patFresh'),
            log: () => {},
        });

        expect(token).toBe('patFresh');
        expect(readCachedToken()).toBe('patFresh');
    });

    it('rejects when the prompt returns nothing', async () => {
        await expect(
            resolveTokenAsync({promptAsync: () => Promise.resolve('')}),
        ).rejects.toThrow(/required/);
        expect(fs.existsSync(tokenCachePath())).toBe(false);
    });
});
