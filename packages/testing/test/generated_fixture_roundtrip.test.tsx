/**
 * Round-trip check: fixture data produced by the fixture-generator's
 * converter (from canned Airtable REST API responses) must render through
 * TestDriver — validating the REST→SDK cell-value conversion end to end.
 */
import React from 'react';
import {render, screen} from '@testing-library/react';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';
import {buildFixtureData} from '../../fixture-generator/src/convert';
import TestDriver from '../src/index';

const STATUS_FIELD_ID = 'fldStatus00000000';
const NAME_FIELD_ID = 'fldName0000000000';

const {fixtureData, warnings} = buildFixtureData(
    {id: 'appRoundTrip00000', name: 'Round trip'},
    [
        {
            schema: {
                id: 'tblTasks000000000',
                name: 'Tasks',
                primaryFieldId: NAME_FIELD_ID,
                fields: [
                    {id: NAME_FIELD_ID, name: 'Name', type: 'singleLineText'},
                    {
                        id: STATUS_FIELD_ID,
                        name: 'Status',
                        type: 'singleSelect',
                        options: {
                            choices: [
                                {id: 'selOpen0000000000', name: 'Open', color: 'greenBright'},
                            ],
                        },
                    },
                ],
            },
            fieldIds: [NAME_FIELD_ID, STATUS_FIELD_ID],
            records: [
                {
                    id: 'recTask1000000000',
                    createdTime: '2024-05-01T00:00:00.000Z',
                    fields: {
                        [NAME_FIELD_ID]: 'Generated task',
                        [STATUS_FIELD_ID]: 'Open',
                    },
                },
            ],
        },
    ],
);

function TaskList() {
    const base = useBase();
    const table = base.getTableByName('Tasks');
    const records = useRecords(table);
    return (
        <ul>
            {records.map((record: any) => (
                <li key={record.id}>
                    {record.name} — {record.getCellValueAsString(STATUS_FIELD_ID)}
                </li>
            ))}
        </ul>
    );
}

describe('generated fixture round trip', () => {
    it('produced no conversion warnings', () => {
        expect(warnings).toEqual([]);
    });

    it('renders records (including converted select values) via TestDriver', async () => {
        const driver = new TestDriver(fixtureData);
        render(
            <driver.Container>
                <TaskList />
            </driver.Container>,
        );

        expect(await screen.findByText('Generated task — Open')).toBeInTheDocument();
    });
});
