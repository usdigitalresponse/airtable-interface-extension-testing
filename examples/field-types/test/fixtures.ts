/**
 * The base fixture (fixtures/field-types.ts, generated from a real base)
 * covers every field type the Airtable Meta API can create. Eight read-only
 * types cannot be created that way — autoNumber, button, createdTime,
 * lastModifiedTime, createdBy, lastModifiedBy, externalSyncSource, aiText —
 * so this module grafts them onto the "Field testing" table with cell values
 * in each type's documented read format, giving the suite coverage of the
 * complete FieldType enum.
 */
import {type FixtureData} from '@usdr/airtable-interface-testing';
import baseFixtureData from '../../../fixtures/field-types';

export const FIELD_TESTING_TABLE_ID = 'tblFieldTesting';
export const TASKS_TABLE_ID = 'tblTasks';
export const ROW_ALL_ID = 'recSampleRow1AllF';
export const ROW_EDGE_ID = 'recSampleRow2Edge';

const TEST_USER = {
    id: 'usrtestdriver0000',
    email: 'test.user@example.com',
    name: 'Test User',
};

const READ_ONLY_FIELDS = [
    {
        id: 'fldAutoNumber0000',
        name: 'Auto number',
        description: null,
        type: 'autoNumber',
        options: null,
    },
    {
        id: 'fldCreatedTime000',
        name: 'Created time',
        description: null,
        type: 'createdTime',
        options: {
            result: {
                type: 'dateTime',
                options: {
                    dateFormat: {name: 'iso', format: 'YYYY-MM-DD'},
                    timeFormat: {name: '24hour', format: 'HH:mm'},
                    timeZone: 'utc',
                },
            },
        },
    },
    {
        id: 'fldModifiedTime00',
        name: 'Last modified time',
        description: null,
        type: 'lastModifiedTime',
        options: {
            isValid: true,
            referencedFieldIds: ['fldSingleLineText'],
            result: {
                type: 'dateTime',
                options: {
                    dateFormat: {name: 'iso', format: 'YYYY-MM-DD'},
                    timeFormat: {name: '24hour', format: 'HH:mm'},
                    timeZone: 'utc',
                },
            },
        },
    },
    {
        id: 'fldCreatedBy00000',
        name: 'Created by',
        description: null,
        type: 'createdBy',
        options: {choices: [TEST_USER]},
    },
    {
        id: 'fldModifiedBy0000',
        name: 'Last modified by',
        description: null,
        type: 'lastModifiedBy',
        options: {referencedFieldIds: ['fldSingleLineText'], choices: [TEST_USER]},
    },
    {
        id: 'fldButton00000000',
        name: 'Button',
        description: null,
        type: 'button',
        options: null,
    },
    {
        id: 'fldSyncSource0000',
        name: 'Sync source',
        description: null,
        type: 'externalSyncSource',
        options: {
            choices: [{id: 'sync0000000000001', name: 'Production CRM', color: 'blueLight2'}],
        },
    },
    {
        id: 'fldAiText00000000',
        name: 'AI text',
        description: null,
        type: 'aiText',
        options: {
            prompt: ['Summarize ', {field: {fieldId: 'fldSingleLineText'}}],
            referencedFieldIds: ['fldSingleLineText'],
        },
    },
];

const READ_ONLY_CELL_VALUES: {[recordId: string]: {[fieldId: string]: unknown}} = {
    [ROW_ALL_ID]: {
        fldAutoNumber0000: 1,
        fldCreatedTime000: '2026-07-22T10:04:40.000Z',
        fldModifiedTime00: '2026-08-01T11:12:03.000Z',
        fldCreatedBy00000: TEST_USER,
        fldModifiedBy0000: TEST_USER,
        fldButton00000000: {label: 'Open dashboard', url: 'https://example.com/dashboard'},
        fldSyncSource0000: {id: 'sync0000000000001', name: 'Production CRM', color: 'blueLight2'},
        fldAiText00000000: {state: 'generated', value: 'A row with every field type.', isStale: false},
    },
    [ROW_EDGE_ID]: {
        fldAutoNumber0000: 2,
        fldCreatedTime000: '2026-08-01T11:12:03.000Z',
        fldModifiedTime00: '2026-08-01T11:12:03.000Z',
        fldCreatedBy00000: TEST_USER,
        // Edge row: button URL formula gone invalid, errored AI generation.
        fldButton00000000: {label: 'Open dashboard', url: null},
        fldAiText00000000: {state: 'error', value: '', isStale: true, errorType: 'PROVIDER_ERROR'},
    },
};

export function makeFixtureData(): FixtureData {
    const fixtureData: FixtureData = JSON.parse(JSON.stringify(baseFixtureData));
    const fieldTestingTable = fixtureData.base.tables.find(
        (table) => table.id === FIELD_TESTING_TABLE_ID,
    );
    if (!fieldTestingTable) {
        throw new Error('fixtures/field-types.ts no longer contains the Field testing table');
    }

    fieldTestingTable.fields.push(...READ_ONLY_FIELDS);
    for (const record of fieldTestingTable.records) {
        Object.assign(record.cellValuesByFieldId, READ_ONLY_CELL_VALUES[record.id] ?? {});
    }
    return fixtureData;
}
