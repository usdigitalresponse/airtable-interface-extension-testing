import {buildFixtureData, type TableExport} from '../src/convert';
import {type ApiTableSchema} from '../src/airtable_api';

const TASKS_SCHEMA: ApiTableSchema = {
    id: 'tblTasks000000000',
    name: 'Tasks',
    primaryFieldId: 'fldName0000000000',
    fields: [
        {id: 'fldName0000000000', name: 'Name', type: 'singleLineText'},
        {
            id: 'fldStatus00000000',
            name: 'Status',
            type: 'singleSelect',
            options: {
                choices: [
                    {id: 'selOpen0000000000', name: 'Open', color: 'greenBright'},
                    {id: 'selDone0000000000', name: 'Done', color: 'grayBright'},
                ],
            },
        },
        {
            id: 'fldTags0000000000',
            name: 'Tags',
            type: 'multipleSelects',
            options: {
                choices: [
                    {id: 'selUrgent00000000', name: 'Urgent', color: 'redBright'},
                    {id: 'selLater000000000', name: 'Later', color: 'blueBright'},
                ],
            },
        },
        {
            id: 'fldProject0000000',
            name: 'Project',
            type: 'multipleRecordLinks',
            options: {linkedTableId: 'tblProjects000000'},
        },
        {id: 'fldCount000000000', name: 'Count', type: 'number', options: {precision: 0}},
    ],
};

const PROJECTS_SCHEMA: ApiTableSchema = {
    id: 'tblProjects000000',
    name: 'Projects',
    primaryFieldId: 'fldProjName000000',
    fields: [{id: 'fldProjName000000', name: 'Name', type: 'singleLineText'}],
};

function makeExports(): Array<TableExport> {
    return [
        {
            schema: TASKS_SCHEMA,
            fieldIds: TASKS_SCHEMA.fields.map((field) => field.id),
            records: [
                {
                    id: 'recTask1000000000',
                    createdTime: '2024-05-01T00:00:00.000Z',
                    fields: {
                        fldName0000000000: 'Write converter',
                        fldStatus00000000: 'Open',
                        fldTags0000000000: ['Urgent', 'Later'],
                        fldProject0000000: ['recProj1000000000'],
                        fldCount000000000: 3,
                    },
                },
            ],
        },
        {
            schema: PROJECTS_SCHEMA,
            fieldIds: ['fldProjName000000'],
            records: [
                {
                    id: 'recProj1000000000',
                    createdTime: '2024-04-01T00:00:00.000Z',
                    fields: {fldProjName000000: 'Fixture generator'},
                },
            ],
        },
    ];
}

describe('buildFixtureData', () => {
    it('converts schema, keeping the primary field first and options as typeOptions', () => {
        const {fixtureData, warnings} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            makeExports(),
        );

        expect(warnings).toEqual([]);
        const tasks = fixtureData.base.tables[0];
        expect(tasks.fields[0].id).toBe('fldName0000000000');
        expect(tasks.fields.map((field) => field.id)).toHaveLength(5);
        expect(tasks.fields[1].options).toEqual(TASKS_SCHEMA.fields[1].options);
    });

    it('resolves select choices to {id, name, color} objects', () => {
        const {fixtureData} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            makeExports(),
        );

        const cellValues = fixtureData.base.tables[0].records[0].cellValuesByFieldId;
        expect(cellValues.fldStatus00000000).toEqual({
            id: 'selOpen0000000000',
            name: 'Open',
            color: 'greenBright',
        });
        expect(cellValues.fldTags0000000000).toEqual([
            {id: 'selUrgent00000000', name: 'Urgent', color: 'redBright'},
            {id: 'selLater000000000', name: 'Later', color: 'blueBright'},
        ]);
    });

    it('resolves linked records to {id, name} using the linked table primary cell', () => {
        const {fixtureData} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            makeExports(),
        );

        const cellValues = fixtureData.base.tables[0].records[0].cellValuesByFieldId;
        expect(cellValues.fldProject0000000).toEqual([
            {id: 'recProj1000000000', name: 'Fixture generator'},
        ]);
    });

    it('passes through scalars untouched and preserves createdTime', () => {
        const {fixtureData} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            makeExports(),
        );

        const record = fixtureData.base.tables[0].records[0];
        expect(record.cellValuesByFieldId.fldCount000000000).toBe(3);
        expect(record.createdTime).toBe('2024-05-01T00:00:00.000Z');
    });

    it('warns once when a linked table is not exported and falls back to ids', () => {
        const exports = makeExports().slice(0, 1);
        const {fixtureData, warnings} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            exports,
        );

        expect(fixtureData.base.tables[0].records[0].cellValuesByFieldId.fldProject0000000).toEqual(
            [{id: 'recProj1000000000', name: 'recProj1000000000'}],
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/linked table tblProjects000000 is not part of this export/);
    });

    it('warns for unknown select choices and keeps the raw string', () => {
        const exports = makeExports();
        exports[0] = {
            ...exports[0],
            records: [
                {
                    id: 'recTask2000000000',
                    createdTime: '2024-05-02T00:00:00.000Z',
                    fields: {fldName0000000000: 'Odd task', fldStatus00000000: 'Archived'},
                },
            ],
        };
        const {fixtureData, warnings} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            exports,
        );

        expect(fixtureData.base.tables[0].records[0].cellValuesByFieldId.fldStatus00000000).toBe(
            'Archived',
        );
        expect(warnings.some((warning) => warning.includes('Archived'))).toBe(true);
    });

    it('filters excluded fields from records', () => {
        const exports = makeExports();
        exports[0] = {
            ...exports[0],
            fieldIds: ['fldName0000000000', 'fldCount000000000'],
        };
        const {fixtureData} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            exports,
        );

        const tasks = fixtureData.base.tables[0];
        expect(tasks.fields.map((field) => field.id)).toEqual([
            'fldName0000000000',
            'fldCount000000000',
        ]);
        expect(Object.keys(tasks.records[0].cellValuesByFieldId)).toEqual([
            'fldName0000000000',
            'fldCount000000000',
        ]);
    });

    it('warns that lookup values keep the REST flat-array shape', () => {
        const exports = makeExports();
        exports[0] = {
            ...exports[0],
            schema: {
                ...TASKS_SCHEMA,
                fields: [
                    ...TASKS_SCHEMA.fields,
                    {
                        id: 'fldLookup00000000',
                        name: 'Project names',
                        type: 'multipleLookupValues',
                        options: {recordLinkFieldId: 'fldProject0000000'},
                    },
                ],
            },
            fieldIds: [...exports[0].fieldIds, 'fldLookup00000000'],
            records: [
                {
                    ...exports[0].records[0],
                    fields: {
                        ...exports[0].records[0].fields,
                        fldLookup00000000: ['Fixture generator'],
                    },
                },
            ],
        };
        const {fixtureData, warnings} = buildFixtureData(
            {id: 'appExample0000000', name: 'Example'},
            exports,
        );

        // Passed through unchanged; the documented SDK read format needs
        // linkedRecordId, which the REST payload does not carry.
        expect(fixtureData.base.tables[0].records[0].cellValuesByFieldId.fldLookup00000000).toEqual(
            ['Fixture generator'],
        );
        expect(warnings.some((warning) => warning.includes('flat-array shape'))).toBe(true);
    });

    it('requires the primary field to be exported', () => {
        const exports = makeExports();
        exports[0] = {...exports[0], fieldIds: ['fldCount000000000']};
        expect(() =>
            buildFixtureData({id: 'appExample0000000', name: 'Example'}, exports),
        ).toThrow(/primary field/);
    });
});
