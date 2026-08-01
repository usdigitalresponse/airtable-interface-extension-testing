#!/usr/bin/env node
/**
 * Fails if the workspaces disagree about the version.
 *
 * Releases are driven by the version in package.json, and a mismatch between
 * packages produces tarballs whose names disagree with the tag — which is how
 * a release fails halfway through. Catching it in CI keeps that off main.
 *
 * Workspaces are discovered from the root package.json, so a new package is
 * covered without touching this script.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readPackageJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
}

/** Expand the `dir/*` and plain `dir` workspace patterns we use. */
function resolveWorkspaceDirs(patterns) {
    const dirs = [];
    for (const pattern of patterns) {
        if (pattern.endsWith('/*')) {
            const parent = path.join(repoRoot, pattern.slice(0, -2));
            if (!existsSync(parent)) {
                continue;
            }
            for (const entry of readdirSync(parent, {withFileTypes: true})) {
                if (entry.isDirectory()) {
                    dirs.push(path.join(parent, entry.name));
                }
            }
        } else {
            dirs.push(path.join(repoRoot, pattern));
        }
    }
    return dirs;
}

const rootFile = path.join(repoRoot, 'package.json');
const rootPackage = readPackageJson(rootFile);

const packageFiles = [rootFile];
for (const dir of resolveWorkspaceDirs(rootPackage.workspaces ?? [])) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file)) {
        packageFiles.push(file);
    }
}

const found = packageFiles.map((file) => {
    const {name, version} = readPackageJson(file);
    return {file: path.relative(repoRoot, file), name, version};
});

const versions = new Set(found.map((entry) => entry.version));

if (versions.size > 1) {
    console.error('Package versions disagree:\n');
    for (const {file, name, version} of found) {
        console.error(`  ${version.padEnd(12)} ${name}  (${file})`);
    }
    console.error(
        '\nEvery package.json in this repo must declare the same version — the ' +
            'release is tagged from it. Bump them together, e.g.:\n' +
            '\n  npm version <version> --workspaces --include-workspace-root --no-git-tag-version\n',
    );
    process.exit(1);
}

console.log(`All ${found.length} package.json files agree on version ${[...versions][0]}.`);
