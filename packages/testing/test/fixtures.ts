import {type FixtureData} from '../src/fixture_data';

export const TASKS_TABLE_ID = 'tblTasks000000000';
export const NAME_FIELD_ID = 'fldTaskName000000';
export const DONE_FIELD_ID = 'fldTaskDone000000';
export const NOTES_TABLE_ID = 'tblNotes000000000';
export const NOTE_FIELD_ID = 'fldNoteBody000000';
export const RECORD_A = 'recTaskAlpha00000';
export const RECORD_B = 'recTaskBeta000000';

export function makeFixtureData(): FixtureData {
    return {
        base: {
            id: 'appTestBase000000',
            name: 'Project tracker',
            tables: [
                {
                    id: TASKS_TABLE_ID,
                    name: 'Tasks',
                    fields: [
                        {id: NAME_FIELD_ID, name: 'Name', type: 'singleLineText'},
                        {id: DONE_FIELD_ID, name: 'Done', type: 'checkbox'},
                    ],
                    records: [
                        {
                            id: RECORD_A,
                            createdTime: '2024-01-01T00:00:00.000Z',
                            cellValuesByFieldId: {
                                [NAME_FIELD_ID]: 'Write tests',
                                [DONE_FIELD_ID]: false,
                            },
                        },
                        {
                            id: RECORD_B,
                            createdTime: '2024-01-02T00:00:00.000Z',
                            cellValuesByFieldId: {
                                [NAME_FIELD_ID]: 'Ship library',
                                [DONE_FIELD_ID]: true,
                            },
                        },
                    ],
                },
                {
                    id: NOTES_TABLE_ID,
                    name: 'Notes',
                    fields: [{id: NOTE_FIELD_ID, name: 'Body', type: 'multilineText'}],
                    records: [],
                },
            ],
        },
        globalConfig: {greeting: 'hello'},
        searchParams: {status: 'open'},
    };
}
