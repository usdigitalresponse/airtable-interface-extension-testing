import React from 'react';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestDriver, {MutationTypes, type Mutation} from '@usdr/airtable-interface-testing';
import {TodoApp} from '../src/app';
import {
    DONE_FIELD_ID,
    NAME_FIELD_ID,
    RECORD_GROCERIES,
    RECORD_LAUNDRY,
    TABLE_ID,
    makeFixtureData,
} from './fixtures';

describe('TodoApp', () => {
    let testDriver: TestDriver;

    beforeEach(() => {
        testDriver = new TestDriver(makeFixtureData());
    });

    function renderApp() {
        return render(
            <testDriver.Container>
                <TodoApp />
            </testDriver.Container>,
        );
    }

    it('renders tasks from the fixture, marking done ones', async () => {
        renderApp();

        expect(await screen.findByText('Buy groceries')).toBeInTheDocument();
        expect(await screen.findByText('Do laundry (done)')).toBeInTheDocument();
    });

    it('adds a task and emits a createMultipleRecords mutation', async () => {
        const mutations: Array<Mutation> = [];
        testDriver.watch('mutation', (mutation) => mutations.push(mutation));
        const user = userEvent.setup();
        renderApp();
        await screen.findByText('Buy groceries');

        await user.type(screen.getByLabelText('New task name'), 'Water plants');
        await user.click(screen.getByRole('button', {name: 'Add task'}));

        expect(await screen.findByText('Water plants')).toBeInTheDocument();
        const createMutations = mutations.filter(
            (mutation) => mutation.type === MutationTypes.CREATE_MULTIPLE_RECORDS,
        );
        expect(createMutations).toHaveLength(1);
        expect(createMutations[0]).toMatchObject({
            tableId: TABLE_ID,
            records: [{cellValuesByFieldId: {[NAME_FIELD_ID]: 'Water plants'}}],
        });
    });

    it('toggles a task done via the configured done field', async () => {
        const user = userEvent.setup();
        renderApp();
        await screen.findByText('Buy groceries');

        await user.click(screen.getByLabelText('Toggle Buy groceries'));

        expect(await screen.findByText('Buy groceries (done)')).toBeInTheDocument();
        // The underlying record data changed, not just the UI.
        const record =
            testDriver.airtableInterface.sdkInitData.baseData.tablesById[TABLE_ID].recordsById[
                RECORD_GROCERIES
            ];
        expect(record.cellValuesByFieldId[DONE_FIELD_ID]).toBe(true);
    });

    it('deletes a task', async () => {
        const user = userEvent.setup();
        renderApp();
        await screen.findByText('Buy groceries');

        const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
        await user.click(deleteButtons[0]);

        expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
        expect(screen.getByText('Do laundry (done)')).toBeInTheDocument();
    });

    it('filters by the "filter" search param and reacts to host updates', async () => {
        const fixtureData = makeFixtureData();
        fixtureData.searchParams = {filter: 'open'};
        const driver = new TestDriver(fixtureData);
        render(
            <driver.Container>
                <TodoApp />
            </driver.Container>,
        );

        expect(await screen.findByText('Buy groceries')).toBeInTheDocument();
        expect(screen.queryByText('Do laundry (done)')).not.toBeInTheDocument();

        act(() => {
            driver.simulateSearchParamsUpdate({filter: 'done'});
        });

        expect(await screen.findByText('Do laundry (done)')).toBeInTheDocument();
        expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
    });

    it('renders the configurable title and reacts to builder changes', async () => {
        renderApp();
        expect(await screen.findByRole('heading', {name: 'Tasks'})).toBeInTheDocument();

        act(() => {
            testDriver.simulateCustomPropertyValueChange('title', 'Sprint board');
        });
        expect(await screen.findByRole('heading', {name: 'Sprint board'})).toBeInTheDocument();

        // The app registered its custom properties with the host.
        const keys = (testDriver.customProperties ?? []).map((property) => property.key);
        expect(keys).toEqual(['title', 'doneField']);
    });

    it('disables adding when record creation is denied', async () => {
        testDriver.simulatePermissionCheck(
            (mutation) => mutation.type !== MutationTypes.CREATE_MULTIPLE_RECORDS,
        );
        renderApp();
        await screen.findByText('Buy groceries');

        expect(screen.getByRole('button', {name: 'Add task'})).toBeDisabled();
        expect(screen.getAllByRole('button', {name: 'Delete'})[0]).toBeEnabled();
    });

    it('expands a record and reports it through the watch API', async () => {
        const expanded: Array<{tableId: string; recordId: string}> = [];
        testDriver.watch('expandRecord', (data) => expanded.push(data));
        const user = userEvent.setup();
        renderApp();
        await screen.findByText('Buy groceries');

        await user.click(screen.getAllByRole('button', {name: 'Expand'})[0]);

        expect(expanded).toEqual([{tableId: TABLE_ID, recordId: RECORD_GROCERIES}]);
    });

    it('reflects direct SDK writes made by the test', async () => {
        renderApp();
        await screen.findByText('Buy groceries');

        await act(async () => {
            await testDriver.base
                .getTableByName('Tasks')
                .updateRecordAsync(RECORD_LAUNDRY, {[DONE_FIELD_ID]: false});
        });

        expect(await screen.findByText('Do laundry')).toBeInTheDocument();
        expect(screen.queryByText('Do laundry (done)')).not.toBeInTheDocument();
    });
});
