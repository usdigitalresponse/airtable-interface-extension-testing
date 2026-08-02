import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestDriver, {MutationTypes, type Mutation} from '@usdr/airtable-interface-testing';
import {FieldTypesApp} from '../src/app';
import {makeFixtureData, ROW_ALL_ID, ROW_EDGE_ID, TASKS_TABLE_ID} from './fixtures';

describe('FieldTypesApp', () => {
    let testDriver: TestDriver;
    let mutations: Array<Mutation>;

    beforeEach(() => {
        testDriver = new TestDriver(makeFixtureData());
        mutations = [];
        testDriver.watch('mutation', (mutation) => mutations.push(mutation));
    });

    function renderApp() {
        return render(
            <testDriver.Container>
                <FieldTypesApp />
            </testDriver.Container>,
        );
    }

    /** The cell values written by the last setMultipleRecordsCellValues mutation. */
    function lastWrite(): {tableId: string; recordId: string; cellValues: any} {
        const writes = mutations.filter(
            (mutation) => mutation.type === MutationTypes.SET_MULTIPLE_RECORDS_CELL_VALUES,
        );
        const last = writes[writes.length - 1] as any;
        return {
            tableId: last.tableId,
            recordId: last.records[0].id,
            cellValues: last.records[0].cellValuesByFieldId,
        };
    }

    it('renders both tables with all their records', async () => {
        renderApp();

        expect(await screen.findByText('Tasks (3 records)')).toBeInTheDocument();
        expect(await screen.findByText('Field testing (2 records)')).toBeInTheDocument();
        // Record names also appear in linked-record editors, so query headings.
        expect(screen.getByRole('heading', {name: 'Buy groceries'})).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {name: 'Sample row 1 — all field types'}),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {name: 'Sample row 2 — edge values'}),
        ).toBeInTheDocument();
    });

    it('renders an editor or read-only view for every field of every record', async () => {
        renderApp();
        await screen.findByText('Tasks (3 records)');

        for (const table of makeFixtureData().base.tables) {
            for (const record of table.records) {
                for (const field of table.fields) {
                    const controls = screen.getAllByLabelText(
                        new RegExp(`^${record.id}:${field.id}`),
                    );
                    expect(controls.length).toBeGreaterThan(0);
                }
            }
        }
    });

    it('edits text fields, writing a string', async () => {
        const user = userEvent.setup();
        renderApp();
        const input = await screen.findByLabelText(`${ROW_ALL_ID}:fldSingleLineText`);

        await user.clear(input);
        await user.type(input, 'Edited text');
        await user.tab();

        expect(lastWrite().cellValues.fldSingleLineText).toBe('Edited text');
        expect(await screen.findByDisplayValue('Edited text')).toBeInTheDocument();
    });

    it('edits number-family fields, writing numbers', async () => {
        const user = userEvent.setup();
        renderApp();

        const cases: Array<[string, string, number]> = [
            ['fldNumberPrecisi3', '3.14', 3.14],
            ['fldPercentPrecis2', '0.75', 0.75],
            ['fldCurrencyEURPre', '42.5', 42.5],
            ['fldDurationHMmSs', '7200', 7200],
            ['fldRating', '5', 5],
        ];
        for (const [fieldId, typed, expected] of cases) {
            const input = await screen.findByLabelText(`${ROW_ALL_ID}:${fieldId}`);
            await user.clear(input);
            await user.type(input, typed);
            await user.tab();
            expect(lastWrite().cellValues[fieldId]).toBe(expected);
        }
    });

    it('toggles a checkbox, writing a boolean', async () => {
        const user = userEvent.setup();
        renderApp();
        const checkbox = await screen.findByLabelText(`${ROW_ALL_ID}:fldCheckbox`);

        expect(checkbox).toBeChecked();
        await user.click(checkbox);

        expect(lastWrite().cellValues.fldCheckbox).toBe(null);
        expect(checkbox).not.toBeChecked();
    });

    it('changes a single select, writing {id}', async () => {
        const user = userEvent.setup();
        renderApp();
        const select = await screen.findByLabelText(`${ROW_ALL_ID}:fldSingleSelectAl`);

        await user.selectOptions(select, 'selRedBright');

        expect(lastWrite().cellValues.fldSingleSelectAl).toEqual({id: 'selRedBright'});
    });

    it('toggles multiple selects, writing Array<{id}>', async () => {
        const user = userEvent.setup();
        renderApp();
        const choice = await screen.findByLabelText(
            `${ROW_EDGE_ID}:fldMultipleSelect:selBlueBright`,
        );

        await user.click(choice);

        expect(lastWrite().cellValues.fldMultipleSelect).toEqual([
            {id: 'selGrayDark1'},
            {id: 'selBlueBright'},
        ]);
    });

    it('edits a date field, writing an ISO string', async () => {
        const user = userEvent.setup();
        renderApp();
        const input = await screen.findByLabelText(`${ROW_ALL_ID}:fldDateIso`);

        await user.clear(input);
        await user.type(input, '2027-01-15');
        await user.tab();

        expect(lastWrite().cellValues.fldDateIso).toBe('2027-01-15');
    });

    it('links records across tables, writing Array<{id, name}>', async () => {
        const user = userEvent.setup();
        renderApp();
        // The Tasks table's "Field testing" link field: link "Do laundry" to
        // sample row 2 as well.
        const checkbox = await screen.findByLabelText(
            `recBuyGroceries:fldFieldTesting:${ROW_EDGE_ID}`,
        );

        await user.click(checkbox);

        const write = lastWrite();
        expect(write.tableId).toBe(TASKS_TABLE_ID);
        expect(write.cellValues.fldFieldTesting).toEqual([
            {id: ROW_ALL_ID, name: 'Sample row 1 — all field types'},
            {id: ROW_EDGE_ID, name: 'Sample row 2 — edge values'},
        ]);
        expect(checkbox).toBeChecked();
    });

    it('appends an attachment by URL, preserving existing attachments', async () => {
        const user = userEvent.setup();
        renderApp();
        const input = await screen.findByLabelText(`${ROW_ALL_ID}:fldAttachments2:add`);

        await user.type(input, 'https://example.com/new-file.pdf');
        await user.tab();

        const written = lastWrite().cellValues.fldAttachments2;
        expect(written).toHaveLength(2);
        expect(written[0].id).toBe('attihiDpq9V96It9d');
        expect(written[1]).toEqual({url: 'https://example.com/new-file.pdf'});
    });

    it('sets collaborators, writing {id} shapes', async () => {
        const user = userEvent.setup();
        renderApp();

        const single = await screen.findByLabelText(`${ROW_EDGE_ID}:fldSingleCollabor`);
        await user.type(single, 'usrPatChen0000000');
        await user.tab();
        expect(lastWrite().cellValues.fldSingleCollabor).toEqual({id: 'usrPatChen0000000'});

        const multiple = await screen.findByLabelText(`${ROW_EDGE_ID}:fldMultipleCollab`);
        await user.type(multiple, 'usrtestdriver0000,usrPatChen0000000');
        await user.tab();
        expect(lastWrite().cellValues.fldMultipleCollab).toEqual([
            {id: 'usrtestdriver0000'},
            {id: 'usrPatChen0000000'},
        ]);
    });

    it('renders read-only computed and metadata fields as text', async () => {
        renderApp();
        await screen.findByText('Field testing (2 records)');

        const expectations: Array<[string, string]> = [
            [`${ROW_ALL_ID}:fldFormula`, 'Sample row 1 — all field types — 42'],
            [`${ROW_ALL_ID}:fldRollupTaskName`, 'Buy groceries, Water plants'],
            [`${ROW_ALL_ID}:fldCountOfLinkedT`, '2'],
            [`${ROW_ALL_ID}:fldLookupTaskName`, 'Buy groceries, Water plants'],
            [`${ROW_ALL_ID}:fldBarcode`, '012345678905'],
            [`${ROW_ALL_ID}:fldAutoNumber0000`, '1'],
            [`${ROW_ALL_ID}:fldCreatedTime000`, '2026-07-22T10:04:40.000Z'],
            [`${ROW_ALL_ID}:fldCreatedBy00000`, 'Test User'],
            [`${ROW_ALL_ID}:fldButton00000000`, 'Open dashboard'],
            [`${ROW_ALL_ID}:fldSyncSource0000`, 'Production CRM'],
            [`${ROW_ALL_ID}:fldAiText00000000`, 'A row with every field type. (generated)'],
            // Edge row: empty values render as a placeholder.
            [`${ROW_EDGE_ID}:fldBarcode`, '(empty)'],
        ];
        for (const [label, text] of expectations) {
            expect(screen.getByLabelText(label)).toHaveTextContent(text);
        }
    });
});
