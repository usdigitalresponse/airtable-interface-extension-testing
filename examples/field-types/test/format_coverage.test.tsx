/**
 * Smoke test for every cell value format.
 *
 * Iterates the SDK's own FieldType enum and asserts, for each member:
 *  1. the fixture contains at least one field of that type;
 *  2. every non-empty cell value read through the real SDK
 *     (record.getCellValue) matches that type's documented "Cell read
 *     format" (https://airtable.com/developers/interface-extensions/api/FieldType);
 *  3. at least one non-empty sample exists, so a validator can't pass
 *     vacuously.
 *
 * If Airtable adds a FieldType enum member, assertion 1 fails until the
 * fixture covers it — that's deliberate.
 */
import React from 'react';
import {render, screen} from '@testing-library/react';
import {FieldType} from '@airtable/blocks/interface/models';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';
import TestDriver from '@usdr/airtable-interface-testing';
import {makeFixtureData} from './fixtures';

/**
 * Collect the Record models of every table through the real `useRecords`
 * hook. (The published interface-alpha build has no `table.selectRecords`;
 * its `useRecords` reads the record store synchronously, so rendering is the
 * portable way to obtain records on both current SDK builds.)
 */
async function collectRecordsByTableAsync(
    testDriver: TestDriver,
): Promise<Map<string, Array<any>>> {
    const collected = new Map<string, Array<any>>();

    function Collector({onRecords}: {onRecords: (tableId: string, records: Array<any>) => void}) {
        const base = useBase();
        return (
            <div>
                {base.tables.map((table: any) => (
                    <TableCollector key={table.id} table={table} onRecords={onRecords} />
                ))}
                <span>collector-done</span>
            </div>
        );
    }
    function TableCollector({
        table,
        onRecords,
    }: {
        table: any;
        onRecords: (tableId: string, records: Array<any>) => void;
    }) {
        const records = useRecords(table);
        onRecords(table.id, records);
        return null;
    }

    const view = render(
        <testDriver.Container>
            <Collector onRecords={(tableId, records) => collected.set(tableId, records)} />
        </testDriver.Container>,
    );
    await screen.findByText('collector-done');
    view.unmount();
    return collected;
}

const isString = (value: unknown): boolean => typeof value === 'string';
const isNumber = (value: unknown): boolean => typeof value === 'number' && !Number.isNaN(value);
const isCollaborator = (value: unknown): boolean => {
    const collaborator = value as {id?: unknown; email?: unknown};
    return (
        typeof collaborator === 'object' &&
        collaborator !== null &&
        typeof collaborator.id === 'string' &&
        typeof collaborator.email === 'string'
    );
};
const isSelectChoice = (value: unknown): boolean => {
    const choice = value as {id?: unknown; name?: unknown};
    return (
        typeof choice === 'object' &&
        choice !== null &&
        typeof choice.id === 'string' &&
        typeof choice.name === 'string'
    );
};
const isArrayOf =
    (item: (value: unknown) => boolean) =>
    (value: unknown): boolean =>
        Array.isArray(value) && value.every(item);
const isIsoDate = (value: unknown): boolean =>
    isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value as string);
const isIsoDateTime = (value: unknown): boolean =>
    isString(value) && !Number.isNaN(Date.parse(value as string));

/** One validator per FieldType, implementing the documented cell READ format. */
const CELL_READ_VALIDATORS: {[fieldType: string]: (value: unknown) => boolean} = {
    [FieldType.SINGLE_LINE_TEXT]: isString,
    [FieldType.MULTILINE_TEXT]: isString,
    [FieldType.RICH_TEXT]: isString,
    [FieldType.EMAIL]: isString,
    [FieldType.URL]: isString,
    [FieldType.PHONE_NUMBER]: isString,
    [FieldType.NUMBER]: isNumber,
    [FieldType.PERCENT]: isNumber,
    [FieldType.CURRENCY]: isNumber,
    [FieldType.DURATION]: isNumber,
    [FieldType.RATING]: isNumber,
    [FieldType.AUTO_NUMBER]: isNumber,
    [FieldType.COUNT]: isNumber,
    [FieldType.CHECKBOX]: (value) => value === true,
    [FieldType.DATE]: isIsoDate,
    [FieldType.DATE_TIME]: isIsoDateTime,
    [FieldType.CREATED_TIME]: isIsoDateTime,
    [FieldType.LAST_MODIFIED_TIME]: isIsoDateTime,
    [FieldType.SINGLE_SELECT]: isSelectChoice,
    [FieldType.MULTIPLE_SELECTS]: isArrayOf(isSelectChoice),
    [FieldType.EXTERNAL_SYNC_SOURCE]: isSelectChoice,
    [FieldType.SINGLE_COLLABORATOR]: isCollaborator,
    [FieldType.CREATED_BY]: isCollaborator,
    [FieldType.LAST_MODIFIED_BY]: isCollaborator,
    [FieldType.MULTIPLE_COLLABORATORS]: isArrayOf(isCollaborator),
    [FieldType.MULTIPLE_RECORD_LINKS]: isArrayOf((link) => {
        const record = link as {id?: unknown; name?: unknown};
        return typeof record.id === 'string' && typeof record.name === 'string';
    }),
    [FieldType.MULTIPLE_ATTACHMENTS]: isArrayOf((attachment) => {
        const file = attachment as {id?: unknown; url?: unknown; filename?: unknown};
        return (
            typeof file.id === 'string' &&
            typeof file.url === 'string' &&
            typeof file.filename === 'string'
        );
    }),
    [FieldType.MULTIPLE_LOOKUP_VALUES]: isArrayOf((entry) => {
        const lookup = entry as {linkedRecordId?: unknown; value?: unknown};
        return (
            typeof lookup === 'object' &&
            lookup !== null &&
            typeof lookup.linkedRecordId === 'string' &&
            'value' in lookup
        );
    }),
    [FieldType.BARCODE]: (value) =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as {text?: unknown}).text === 'string',
    [FieldType.BUTTON]: (value) => {
        const button = value as {label?: unknown; url?: unknown};
        return (
            typeof button === 'object' &&
            button !== null &&
            typeof button.label === 'string' &&
            (button.url === null || typeof button.url === 'string')
        );
    },
    [FieldType.AI_TEXT]: (value) => {
        const aiText = value as {state?: unknown; value?: unknown; isStale?: unknown};
        return (
            typeof aiText === 'object' &&
            aiText !== null &&
            ['empty', 'loading', 'generated', 'error'].includes(aiText.state as string) &&
            typeof aiText.value === 'string' &&
            typeof aiText.isStale === 'boolean'
        );
    },
    // Formula and rollup values take the type of options.result; the fixture
    // uses string-producing formulas.
    [FieldType.FORMULA]: isString,
    [FieldType.ROLLUP]: isString,
};

describe('FieldType coverage', () => {
    const testDriver = new TestDriver(makeFixtureData());
    const allFieldTypes = Object.values(FieldType) as Array<string>;

    it('has a validator for every FieldType enum member', () => {
        for (const fieldType of allFieldTypes) {
            expect(CELL_READ_VALIDATORS[fieldType]).toBeDefined();
        }
    });

    it.each(allFieldTypes)('fixture contains at least one %s field', (fieldType) => {
        const fields = testDriver.base.tables.flatMap((table: any) =>
            table.fields.filter((field: any) => field.type === fieldType),
        );
        expect(fields.length).toBeGreaterThan(0);
    });

    it.each(allFieldTypes)(
        'every %s cell value matches the documented read format',
        async (fieldType) => {
            const validate = CELL_READ_VALIDATORS[fieldType];
            const recordsByTable = await collectRecordsByTableAsync(testDriver);
            let nonEmptySamples = 0;

            for (const table of testDriver.base.tables) {
                const fields = table.fields.filter((field: any) => field.type === fieldType);
                if (fields.length === 0) {
                    continue;
                }
                for (const record of recordsByTable.get(table.id) ?? []) {
                    for (const field of fields) {
                        const value = record.getCellValue(field.id);
                        if (value === null) {
                            continue;
                        }
                        if (Array.isArray(value) && value.length === 0) {
                            continue;
                        }
                        nonEmptySamples++;
                        if (!validate(value)) {
                            throw new Error(
                                `${table.name}.${field.name} (${fieldType}) cell value does ` +
                                    `not match the documented read format: ` +
                                    JSON.stringify(value),
                            );
                        }
                    }
                }
            }

            expect(nonEmptySamples).toBeGreaterThan(0);
        },
    );
});
