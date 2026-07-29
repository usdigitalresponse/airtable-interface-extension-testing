import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {useBase, useRecords, useGlobalConfig} from '@airtable/blocks/interface/ui';
import TestDriver, {MutationTypes, type Mutation} from '../src/index';
import {
    DONE_FIELD_ID,
    NAME_FIELD_ID,
    RECORD_A,
    RECORD_B,
    TASKS_TABLE_ID,
    makeFixtureData,
} from './fixtures';

function TaskList() {
    const base = useBase();
    const table = base.getTableByName('Tasks');
    const records = useRecords(table);
    return (
        <ul>
            {records.map((record: any) => (
                <li key={record.id}>
                    {String(record.getCellValue(NAME_FIELD_ID))}
                    {record.getCellValue(DONE_FIELD_ID) ? ' (done)' : ''}
                </li>
            ))}
        </ul>
    );
}

function Greeting() {
    const globalConfig = useGlobalConfig();
    return <div>greeting: {String(globalConfig.get('greeting'))}</div>;
}

describe('TestDriver', () => {
    let testDriver: TestDriver;

    beforeEach(() => {
        testDriver = new TestDriver(makeFixtureData());
    });

    describe('model getters', () => {
        it('exposes the base with fixture schema', () => {
            expect(testDriver.base.id).toBe('appTestBase000000');
            expect(testDriver.base.name).toBe('Project tracker');
            expect(testDriver.base.tables.map((table: any) => table.name)).toEqual([
                'Tasks',
                'Notes',
            ]);
        });

        it('exposes the session for the default collaborator', () => {
            expect(testDriver.session.currentUser).not.toBeNull();
            expect(testDriver.session.currentUser.id).toBe('usrtestdriver0000');
        });

        it('exposes globalConfig seeded from the fixture', () => {
            expect(testDriver.globalConfig.get('greeting')).toBe('hello');
        });

        it('exposes search params seeded from the fixture', () => {
            expect(testDriver.searchParams).toEqual({status: 'open'});
        });
    });

    describe('Container', () => {
        it('renders an extension that reads base schema and records', async () => {
            render(
                <testDriver.Container>
                    <TaskList />
                </testDriver.Container>,
            );

            expect(await screen.findByText('Write tests')).toBeInTheDocument();
            expect(await screen.findByText('Ship library (done)')).toBeInTheDocument();
        });

        it('renders an extension that reads globalConfig', async () => {
            render(
                <testDriver.Container>
                    <Greeting />
                </testDriver.Container>,
            );

            expect(await screen.findByText('greeting: hello')).toBeInTheDocument();
        });

        it('supports two sequential drivers with independent state', async () => {
            const first = render(
                <testDriver.Container>
                    <TaskList />
                </testDriver.Container>,
            );
            await screen.findByText('Write tests');
            first.unmount();

            const secondDriver = new TestDriver(makeFixtureData());
            await act(async () => {
                await secondDriver.base
                    .getTableByName('Tasks')
                    .updateRecordAsync(RECORD_A, {[NAME_FIELD_ID]: 'Independent'});
            });
            render(
                <secondDriver.Container>
                    <TaskList />
                </secondDriver.Container>,
            );
            expect(await screen.findByText('Independent')).toBeInTheDocument();
            expect(testDriver.base.getTableByName('Tasks')).toBeTruthy();
        });
    });

    describe('record mutations through the real SDK', () => {
        it('createRecordAsync appears in useRecords output and emits a mutation', async () => {
            const mutations: Array<Mutation> = [];
            testDriver.watch('mutation', (mutation) => mutations.push(mutation));

            render(
                <testDriver.Container>
                    <TaskList />
                </testDriver.Container>,
            );
            await screen.findByText('Write tests');

            let newRecordId: string = '';
            await act(async () => {
                newRecordId = await testDriver.base
                    .getTableByName('Tasks')
                    .createRecordAsync({[NAME_FIELD_ID]: 'Brand new task'});
            });

            expect(await screen.findByText('Brand new task')).toBeInTheDocument();
            expect(newRecordId).toMatch(/^rec/);
            expect(mutations).toHaveLength(1);
            expect(mutations[0]).toEqual({
                type: MutationTypes.CREATE_MULTIPLE_RECORDS,
                tableId: TASKS_TABLE_ID,
                records: [
                    {
                        id: newRecordId,
                        cellValuesByFieldId: {[NAME_FIELD_ID]: 'Brand new task'},
                    },
                ],
            });
        });

        it('creating multiple records generates unique ids', async () => {
            const table = testDriver.base.getTableByName('Tasks');
            const recordIds = await table.createRecordsAsync([
                {fields: {[NAME_FIELD_ID]: 'One'}},
                {fields: {[NAME_FIELD_ID]: 'Two'}},
                {fields: {[NAME_FIELD_ID]: 'Three'}},
            ]);
            expect(new Set(recordIds).size).toBe(3);
        });

        it('updateRecordAsync updates rendered cell values and emits a mutation', async () => {
            const mutations: Array<Mutation> = [];
            testDriver.watch('mutation', (mutation) => mutations.push(mutation));

            render(
                <testDriver.Container>
                    <TaskList />
                </testDriver.Container>,
            );
            await screen.findByText('Write tests');

            await act(async () => {
                await testDriver.base
                    .getTableByName('Tasks')
                    .updateRecordAsync(RECORD_A, {[DONE_FIELD_ID]: true});
            });

            expect(await screen.findByText('Write tests (done)')).toBeInTheDocument();
            expect(mutations).toEqual([
                {
                    type: MutationTypes.SET_MULTIPLE_RECORDS_CELL_VALUES,
                    tableId: TASKS_TABLE_ID,
                    records: [{id: RECORD_A, cellValuesByFieldId: {[DONE_FIELD_ID]: true}}],
                },
            ]);
        });

        it('deleteRecordAsync removes the record from useRecords output', async () => {
            const mutations: Array<Mutation> = [];
            testDriver.watch('mutation', (mutation) => mutations.push(mutation));

            render(
                <testDriver.Container>
                    <TaskList />
                </testDriver.Container>,
            );
            await screen.findByText('Write tests');

            await act(async () => {
                await testDriver.base.getTableByName('Tasks').deleteRecordAsync(RECORD_B);
            });

            expect(screen.queryByText('Ship library (done)')).not.toBeInTheDocument();
            expect(screen.getByText('Write tests')).toBeInTheDocument();
            expect(mutations).toEqual([
                {
                    type: MutationTypes.DELETE_MULTIPLE_RECORDS,
                    tableId: TASKS_TABLE_ID,
                    recordIds: [RECORD_B],
                },
            ]);
        });
    });

    describe('globalConfig mutations', () => {
        it('setAsync round-trips and emits a mutation', async () => {
            const mutations: Array<Mutation> = [];
            testDriver.watch('mutation', (mutation) => mutations.push(mutation));

            await testDriver.globalConfig.setAsync('greeting', 'goodbye');

            expect(testDriver.globalConfig.get('greeting')).toBe('goodbye');
            expect(mutations).toEqual([
                {
                    type: MutationTypes.SET_MULTIPLE_GLOBAL_CONFIG_PATHS,
                    updates: [{path: ['greeting'], value: 'goodbye'}],
                },
            ]);
        });

        it('re-renders hooks observing globalConfig', async () => {
            render(
                <testDriver.Container>
                    <Greeting />
                </testDriver.Container>,
            );
            await screen.findByText('greeting: hello');

            await act(async () => {
                await testDriver.globalConfig.setAsync('greeting', 'howdy');
            });

            expect(await screen.findByText('greeting: howdy')).toBeInTheDocument();
        });
    });

    describe('simulatePermissionCheck', () => {
        it('rejects denied mutations with a descriptive error', async () => {
            testDriver.simulatePermissionCheck(
                (mutation) => mutation.type !== MutationTypes.CREATE_MULTIPLE_RECORDS,
            );

            const table = testDriver.base.getTableByName('Tasks');
            await expect(
                table.createRecordAsync({[NAME_FIELD_ID]: 'Nope'}),
            ).rejects.toThrow(/configured to deny/);

            await expect(
                table.updateRecordAsync(RECORD_A, {[DONE_FIELD_ID]: true}),
            ).resolves.toBeUndefined();
        });

        it('is reflected in permission-check helpers', () => {
            testDriver.simulatePermissionCheck(() => false);
            const table = testDriver.base.getTableByName('Tasks');
            expect(table.hasPermissionToCreateRecord()).toBe(false);
        });
    });

    describe('watch/unwatch', () => {
        it('unwatch stops delivery', async () => {
            const seen: Array<Mutation> = [];
            const handler = (mutation: Mutation) => seen.push(mutation);
            testDriver.watch('mutation', handler);
            await testDriver.globalConfig.setAsync('greeting', 'one');
            testDriver.unwatch('mutation', handler);
            await testDriver.globalConfig.setAsync('greeting', 'two');
            expect(seen).toHaveLength(1);
        });
    });
});
