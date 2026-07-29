import {type FixtureData} from '@usdr/airtable-interface-testing';

export const TABLE_ID = 'tblTodoTasks00000';
export const NAME_FIELD_ID = 'fldTodoName000000';
export const DONE_FIELD_ID = 'fldTodoDone000000';
export const RECORD_GROCERIES = 'recGroceries00000';
export const RECORD_LAUNDRY = 'recLaundry0000000';

export function makeFixtureData(): FixtureData {
    return {
        base: {
            id: 'appTodoExample000',
            name: 'Todo base',
            tables: [
                {
                    id: TABLE_ID,
                    name: 'Tasks',
                    fields: [
                        {id: NAME_FIELD_ID, name: 'Name', type: 'singleLineText'},
                        {id: DONE_FIELD_ID, name: 'Done', type: 'checkbox'},
                    ],
                    records: [
                        {
                            id: RECORD_GROCERIES,
                            cellValuesByFieldId: {
                                [NAME_FIELD_ID]: 'Buy groceries',
                                [DONE_FIELD_ID]: false,
                            },
                        },
                        {
                            id: RECORD_LAUNDRY,
                            cellValuesByFieldId: {
                                [NAME_FIELD_ID]: 'Do laundry',
                                [DONE_FIELD_ID]: true,
                            },
                        },
                    ],
                },
            ],
        },
        // Pre-configure the custom properties the app defines.
        globalConfig: {doneField: DONE_FIELD_ID},
    };
}
