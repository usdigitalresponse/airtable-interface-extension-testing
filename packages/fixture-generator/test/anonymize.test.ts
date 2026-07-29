import {type FixtureData} from '@usdr/airtable-interface-testing';
import {anonymizeFixtureData} from '../src/anonymize';

function makeFixture(): FixtureData {
    return {
        base: {
            id: 'app1234567890abcd',
            name: 'test base name',
            tables: [
                {
                    id: 'tblAAAAAAAAAAAAAA',
                    name: 'Tasks',
                    description: null,
                    fields: [
                        {
                            id: 'fldAAAAAAAAAAAAA1',
                            name: 'Name',
                            description: null,
                            type: 'singleLineText',
                            options: null,
                        },
                        {
                            id: 'fldAAAAAAAAAAAAA2',
                            name: 'Status',
                            description: null,
                            type: 'singleSelect',
                            options: {
                                choices: [
                                    {id: 'selXXXXXXXXXXXXX1', name: 'Open', color: 'greenBright'},
                                    {id: 'selXXXXXXXXXXXXX2', name: 'Done', color: 'grayBright'},
                                ],
                            },
                        },
                        {
                            id: 'fldAAAAAAAAAAAAA3',
                            name: 'Project',
                            description: null,
                            type: 'multipleRecordLinks',
                            options: {linkedTableId: 'tblBBBBBBBBBBBBBB'},
                        },
                    ],
                    records: [
                        {
                            id: 'recAAAAAAAAAAAAA1',
                            createdTime: '2024-01-01T00:00:00.000Z',
                            cellValuesByFieldId: {
                                fldAAAAAAAAAAAAA1: 'Buy groceries',
                                fldAAAAAAAAAAAAA2: {
                                    id: 'selXXXXXXXXXXXXX1',
                                    name: 'Open',
                                    color: 'greenBright',
                                },
                                fldAAAAAAAAAAAAA3: [
                                    {id: 'recBBBBBBBBBBBBB1', name: 'Big launch'},
                                ],
                            },
                        },
                    ],
                },
                {
                    id: 'tblBBBBBBBBBBBBBB',
                    name: 'Projects',
                    description: null,
                    fields: [
                        {
                            id: 'fldBBBBBBBBBBBBB1',
                            name: 'Name',
                            description: null,
                            type: 'singleLineText',
                            options: null,
                        },
                    ],
                    records: [
                        {
                            id: 'recBBBBBBBBBBBBB1',
                            createdTime: '2024-01-01T00:00:00.000Z',
                            cellValuesByFieldId: {fldBBBBBBBBBBBBB1: 'Big launch'},
                        },
                    ],
                },
            ],
        },
    };
}

describe('anonymizeFixtureData', () => {
    it('derives IDs from names, keeping prefixes', () => {
        const result = anonymizeFixtureData(makeFixture());

        expect(result.base.id).toBe('appTestBaseName');
        expect(result.base.tables[0].id).toBe('tblTasks');
        expect(result.base.tables[1].id).toBe('tblProjects');
        expect(result.base.tables[0].fields.map((field) => field.id)).toEqual([
            'fldName',
            'fldStatus',
            'fldProject',
        ]);
    });

    it('does not modify its input', () => {
        const input = makeFixture();
        anonymizeFixtureData(input);
        expect(input.base.id).toBe('app1234567890abcd');
        expect(input.base.tables[0].fields[0].id).toBe('fldAAAAAAAAAAAAA1');
    });

    it('names record IDs from the primary cell value', () => {
        const result = anonymizeFixtureData(makeFixture());
        expect(result.base.tables[0].records[0].id).toBe('recBuyGroceries');
        expect(result.base.tables[1].records[0].id).toBe('recBigLaunch');
    });

    it('rewrites cellValuesByFieldId keys and select/linked-record references', () => {
        const result = anonymizeFixtureData(makeFixture());
        const record = result.base.tables[0].records[0];

        expect(record.cellValuesByFieldId).toEqual({
            fldName: 'Buy groceries',
            fldStatus: {id: 'selOpen', name: 'Open', color: 'greenBright'},
            fldProject: [{id: 'recBigLaunch', name: 'Big launch'}],
        });
    });

    it('rewrites select choice IDs in field options and linkedTableId', () => {
        const result = anonymizeFixtureData(makeFixture());
        const [, statusField, projectField] = result.base.tables[0].fields;

        expect((statusField.options as any).choices.map((choice: any) => choice.id)).toEqual([
            'selOpen',
            'selDone',
        ]);
        expect((projectField.options as any).linkedTableId).toBe('tblProjects');
    });

    it('numbers colliding IDs from the second occurrence on', () => {
        const result = anonymizeFixtureData(makeFixture());
        // Both tables have a field named "Name"; field IDs are globally unique.
        expect(result.base.tables[0].fields[0].id).toBe('fldName');
        expect(result.base.tables[1].fields[0].id).toBe('fldName2');
    });

    it('truncates to 17 characters including the prefix', () => {
        const fixture = makeFixture();
        fixture.base.name = 'An extremely long base name that keeps going';
        fixture.base.tables[0].records[0].cellValuesByFieldId.fldAAAAAAAAAAAAA1 =
            'A very long task title indeed';
        const result = anonymizeFixtureData(fixture);

        expect(result.base.id).toBe('appAnExtremelyLon');
        expect(result.base.id).toHaveLength(17);
        expect(result.base.tables[0].records[0].id).toBe('recAVeryLongTaskT');
    });

    it('numbers colliding truncated IDs within the length budget', () => {
        const fixture = makeFixture();
        fixture.base.tables[0].records.push(
            {
                id: 'recAAAAAAAAAAAAA2',
                createdTime: '2024-01-01T00:00:00.000Z',
                cellValuesByFieldId: {fldAAAAAAAAAAAAA1: 'A very long task title one'},
            },
            {
                id: 'recAAAAAAAAAAAAA3',
                createdTime: '2024-01-01T00:00:00.000Z',
                cellValuesByFieldId: {fldAAAAAAAAAAAAA1: 'A very long task title two'},
            },
        );
        fixture.base.tables[0].records[0].cellValuesByFieldId.fldAAAAAAAAAAAAA1 =
            'A very long task title zero';
        const result = anonymizeFixtureData(fixture);

        const ids = result.base.tables[0].records.map((record) => record.id);
        expect(ids).toEqual(['recAVeryLongTaskT', 'recAVeryLongTask2', 'recAVeryLongTask3']);
        for (const id of ids) {
            expect(id.length).toBeLessThanOrEqual(17);
        }
    });

    it('falls back to generic names for empty values', () => {
        const fixture = makeFixture();
        fixture.base.tables[0].records[0].cellValuesByFieldId.fldAAAAAAAAAAAAA1 = '';
        const result = anonymizeFixtureData(fixture);
        expect(result.base.tables[0].records[0].id).toBe('recRecord');
    });
});
