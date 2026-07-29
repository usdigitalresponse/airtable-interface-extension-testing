#!/usr/bin/env node
/**
 * Interactive fixture generator for Airtable interface-extension tests.
 * Pulls base schema and records through the Airtable REST API and writes a
 * FixtureData file, letting you choose which tables and fields to export.
 */
import {parseArgs} from 'node:util';
import {checkbox, password, select} from '@inquirer/prompts';
import {AirtableApi} from './airtable_api';
import {anonymizeFixtureData} from './anonymize';
import {buildFixtureData, type TableExport} from './convert';
import {writeFixtureFile} from './emit';
import {resolveTokenAsync, tokenCachePath} from './token';

const HELP = `Generate test fixture data for Airtable interface extensions.

Usage: airtable-testing-fixtures [options]

Options:
  --base <appId>        Base to export (skips the interactive base picker)
  --out <path>          Output file (default: fixtures/<base-name>.ts)
  --json                Emit plain JSON instead of a TypeScript module
  --all                 Export all tables and fields without prompting
  --keep-ids            Keep real Airtable IDs instead of anonymizing them
                        (default: IDs become name-derived, e.g. appTestBaseName)
  --max-records <n>     Per-table record cap (default: 500)
  --token <pat>         Personal Access Token for this run only — never
                        written to the cache file (use in CI)
  --reset-token         Forget the cached token, then prompt for a new one
  --help                Show this help

The token needs the schema.bases:read and data.records:read scopes.
Precedence: --token, then the AIRTABLE_TOKEN environment variable (also
never cached), then the cache file, then an interactive prompt. Only an
interactively entered token is cached, in ${tokenCachePath()} (mode 0600).`;

function slugify(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'fixture'
    );
}

export async function mainAsync(argv: Array<string> = process.argv.slice(2)): Promise<void> {
    const {values: flags} = parseArgs({
        args: argv,
        options: {
            base: {type: 'string'},
            out: {type: 'string'},
            json: {type: 'boolean', default: false},
            all: {type: 'boolean', default: false},
            'keep-ids': {type: 'boolean', default: false},
            'max-records': {type: 'string'},
            token: {type: 'string'},
            'reset-token': {type: 'boolean', default: false},
            help: {type: 'boolean', default: false},
        },
    });

    if (flags.help) {
        console.log(HELP);
        return;
    }

    const maxRecords = flags['max-records'] ? Number(flags['max-records']) : 500;
    if (!Number.isInteger(maxRecords) || maxRecords <= 0) {
        throw new Error('--max-records must be a positive integer');
    }

    const token = await resolveTokenAsync({
        tokenFlag: flags.token,
        resetToken: flags['reset-token'],
        envToken: process.env.AIRTABLE_TOKEN,
        promptAsync: () =>
            password({
                message:
                    'Airtable Personal Access Token (scopes: schema.bases:read, data.records:read):',
                mask: '*',
            }),
    });
    const api = new AirtableApi(token);

    // 1. Pick a base.
    let baseId = flags.base;
    let baseName: string;
    if (baseId) {
        const bases = await api.listBasesAsync();
        const match = bases.find((candidate) => candidate.id === baseId);
        if (!match) {
            throw new Error(`Base ${baseId} was not found among bases this token can access.`);
        }
        baseName = match.name;
    } else {
        const bases = await api.listBasesAsync();
        if (bases.length === 0) {
            throw new Error('This token has no accessible bases.');
        }
        baseId = await select({
            message: 'Which base do you want to export?',
            choices: bases.map((base) => ({name: `${base.name} (${base.id})`, value: base.id})),
        });
        baseName = bases.find((base) => base.id === baseId)!.name;
    }

    // 2. Pick tables and fields.
    const schema = await api.getBaseSchemaAsync(baseId);
    let selectedTables;
    if (flags.all) {
        selectedTables = schema;
    } else {
        const tableIds = await checkbox({
            message: 'Which tables should be included?',
            required: true,
            choices: schema.map((table) => ({
                name: `${table.name} (${table.fields.length} fields)`,
                value: table.id,
                checked: true,
            })),
        });
        selectedTables = schema.filter((table) => tableIds.includes(table.id));
    }

    const tableExports: Array<TableExport> = [];
    for (const table of selectedTables) {
        let fieldIds: Array<string>;
        if (flags.all) {
            fieldIds = table.fields.map((field) => field.id);
        } else {
            fieldIds = await checkbox({
                message: `Fields to include from "${table.name}" (primary field is always included):`,
                choices: table.fields.map((field) => ({
                    name: `${field.name} (${field.type})`,
                    value: field.id,
                    checked: true,
                    disabled:
                        field.id === table.primaryFieldId ? '(primary field)' : false,
                })),
            });
            if (!fieldIds.includes(table.primaryFieldId)) {
                fieldIds = [table.primaryFieldId, ...fieldIds];
            }
        }

        console.log(`Fetching records from "${table.name}"…`);
        const records = await api.listRecordsAsync(baseId, table.id, {
            fieldIds,
            maxRecords,
        });
        console.log(`  ${records.length} record${records.length === 1 ? '' : 's'}`);
        tableExports.push({schema: table, fieldIds, records});
    }

    // 3. Convert, anonymize, and write.
    const {fixtureData, warnings} = buildFixtureData({id: baseId, name: baseName}, tableExports);
    for (const warning of warnings) {
        console.warn(`Warning: ${warning}`);
    }

    const outputData = flags['keep-ids'] ? fixtureData : anonymizeFixtureData(fixtureData);

    const format: 'ts' | 'json' = flags.json ? 'json' : 'ts';
    const outPath = flags.out ?? `fixtures/${slugify(baseName)}.${format}`;
    writeFixtureFile(outputData, outPath, format);
    console.log(`Wrote ${outPath}`);
}

const isDirectRun =
    typeof process.argv[1] === 'string' && /airtable-testing-fixtures|cli\.[cm]?js$/.test(process.argv[1]);
if (isDirectRun) {
    mainAsync().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
