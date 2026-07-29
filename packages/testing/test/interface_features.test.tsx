import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {
    expandRecord,
    useBase,
    useCustomProperties,
    useRecords,
    useSearchParams,
} from '@airtable/blocks/interface/ui';
import TestDriver, {type CustomPropertyForAirtableInterface} from '../src/index';
import {DONE_FIELD_ID, NAME_FIELD_ID, RECORD_A, TASKS_TABLE_ID, makeFixtureData} from './fixtures';

function SearchParamsView() {
    const {searchParams, setSearchParamsAsync} = useSearchParams();
    return (
        <div>
            <div>status: {searchParams.status ?? '(none)'}</div>
            <button onClick={() => setSearchParamsAsync({status: 'closed'})}>Close</button>
        </div>
    );
}

function getCustomProperties(base: any) {
    const table = base.getTableByName('Tasks');
    return [
        {key: 'title', label: 'Title', type: 'string' as const, defaultValue: 'Tasks!'},
        {key: 'showDone', label: 'Show done', type: 'boolean' as const, defaultValue: true},
        {
            key: 'doneField',
            label: 'Done field',
            type: 'field' as const,
            table,
            shouldFieldBeAllowed: (field: {id: string; config: {type: string}}) =>
                field.config.type === 'checkbox',
        },
    ];
}

function CustomPropertiesView() {
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomProperties);
    if (errorState) {
        return <div>error: {errorState.error.message}</div>;
    }
    const doneField = customPropertyValueByKey.doneField as {name: string} | undefined;
    return (
        <div>
            <h1>{String(customPropertyValueByKey.title)}</h1>
            <div>showDone: {String(customPropertyValueByKey.showDone)}</div>
            <div>doneField: {doneField ? doneField.name : '(unset)'}</div>
        </div>
    );
}

function ExpandButton() {
    const base = useBase();
    const table = base.getTableByName('Tasks');
    const records = useRecords(table);
    return <button onClick={() => expandRecord(records[0])}>Expand first</button>;
}

describe('interface-specific features', () => {
    let testDriver: TestDriver;

    beforeEach(() => {
        testDriver = new TestDriver(makeFixtureData());
    });

    describe('search params', () => {
        it('exposes fixture search params to useSearchParams', async () => {
            render(
                <testDriver.Container>
                    <SearchParamsView />
                </testDriver.Container>,
            );
            expect(await screen.findByText('status: open')).toBeInTheDocument();
        });

        it('simulateSearchParamsUpdate re-renders the hook (host → extension)', async () => {
            render(
                <testDriver.Container>
                    <SearchParamsView />
                </testDriver.Container>,
            );
            await screen.findByText('status: open');

            act(() => {
                testDriver.simulateSearchParamsUpdate({status: 'archived'});
            });

            expect(await screen.findByText('status: archived')).toBeInTheDocument();
            expect(testDriver.searchParams).toEqual({status: 'archived'});
        });

        it('setSearchParamsAsync updates driver state and emits a watch event (extension → host)', async () => {
            const setEvents: Array<Record<string, string>> = [];
            testDriver.watch('setSearchParams', (params) => setEvents.push(params));

            render(
                <testDriver.Container>
                    <SearchParamsView />
                </testDriver.Container>,
            );
            await screen.findByText('status: open');

            await act(async () => {
                screen.getByRole('button', {name: 'Close'}).click();
            });

            expect(await screen.findByText('status: closed')).toBeInTheDocument();
            expect(testDriver.searchParams).toEqual({status: 'closed'});
            expect(setEvents).toEqual([{status: 'closed'}]);
        });
    });

    describe('custom properties', () => {
        it('registers definitions and reads default values', async () => {
            const registrations: Array<Array<CustomPropertyForAirtableInterface>> = [];
            testDriver.watch('setCustomProperties', (properties) =>
                registrations.push(properties),
            );

            render(
                <testDriver.Container>
                    <CustomPropertiesView />
                </testDriver.Container>,
            );

            expect(await screen.findByText('Tasks!')).toBeInTheDocument();
            expect(screen.getByText('showDone: true')).toBeInTheDocument();

            expect(registrations.length).toBeGreaterThan(0);
            expect(testDriver.customProperties).not.toBeNull();
            const byKey = Object.fromEntries(
                testDriver.customProperties!.map((property) => [property.key, property]),
            );
            expect(byKey.title.type).toBe('string');
            expect(byKey.showDone.type).toBe('boolean');
            expect(byKey.doneField.type).toBe('fieldId');
            // shouldFieldBeAllowed filtered the field list down to checkboxes.
            expect(byKey.doneField.possibleValues).toEqual([DONE_FIELD_ID]);
        });

        it('simulateCustomPropertyValueChange re-renders with the new value', async () => {
            render(
                <testDriver.Container>
                    <CustomPropertiesView />
                </testDriver.Container>,
            );
            await screen.findByText('Tasks!');

            act(() => {
                testDriver.simulateCustomPropertyValueChange('title', 'My renamed block');
            });
            expect(await screen.findByText('My renamed block')).toBeInTheDocument();

            act(() => {
                testDriver.simulateCustomPropertyValueChange('doneField', DONE_FIELD_ID);
            });
            expect(await screen.findByText('doneField: Done')).toBeInTheDocument();
        });

        it('fixture globalConfig can pre-set custom property values', async () => {
            const fixtureData = makeFixtureData();
            fixtureData.globalConfig = {title: 'Preconfigured'};
            const driver = new TestDriver(fixtureData);

            render(
                <driver.Container>
                    <CustomPropertiesView />
                </driver.Container>,
            );
            expect(await screen.findByText('Preconfigured')).toBeInTheDocument();
        });
    });

    describe('expandRecord', () => {
        it('emits an expandRecord watch event', async () => {
            const expanded: Array<{tableId: string; recordId: string}> = [];
            testDriver.watch('expandRecord', (data) => expanded.push(data));

            render(
                <testDriver.Container>
                    <ExpandButton />
                </testDriver.Container>,
            );
            const button = await screen.findByRole('button', {name: 'Expand first'});

            act(() => {
                button.click();
            });

            expect(expanded).toEqual([{tableId: TASKS_TABLE_ID, recordId: RECORD_A}]);
        });
    });

    describe('sub-element selection', () => {
        it('setSelectedSubElementAsync emits a watch event', async () => {
            const selections: Array<unknown> = [];
            testDriver.watch('setSelectedSubElement', (selection) => selections.push(selection));

            await testDriver._sdk.setSelectedSubElementAsync({subElementId: 'subEl1'});
            expect(selections).toEqual([{subElementId: 'subEl1'}]);
        });

        it('simulateSubElementSelection notifies host-subscription callbacks', async () => {
            const updates: Array<{selectedSubElementId: string | null}> = [];
            await testDriver._sdk.fetchAndSubscribeToSelectionDataAsync(
                (data: {selectedSubElementId: string | null}) => updates.push(data),
            );

            testDriver.simulateSubElementSelection('subEl9');
            testDriver.simulateSubElementSelection(null);

            expect(updates).toEqual([
                {selectedSubElementId: 'subEl9'},
                {selectedSubElementId: null},
            ]);
        });
    });

    describe('foreign records', () => {
        it('defaults to empty results', async () => {
            await expect(
                testDriver.airtableInterface.fetchForeignRecordsAsync(
                    TASKS_TABLE_ID,
                    RECORD_A,
                    NAME_FIELD_ID,
                    '',
                ),
            ).resolves.toEqual({records: []});
        });

        it('uses the handler installed via simulateForeignRecords', async () => {
            testDriver.simulateForeignRecords((tableId, recordId, fieldId, filterString) => [
                {id: 'recForeign0000001', name: `match for ${filterString}`},
            ]);

            await expect(
                testDriver.airtableInterface.fetchForeignRecordsAsync(
                    TASKS_TABLE_ID,
                    RECORD_A,
                    NAME_FIELD_ID,
                    'gro',
                ),
            ).resolves.toEqual({records: [{id: 'recForeign0000001', name: 'match for gro'}]});
        });
    });

    describe('edit mode run context', () => {
        it('defaults to view mode and honors fixture overrides', () => {
            expect(testDriver._sdk.getBlockRunContext().isPageElementInEditMode).toBe(false);

            const fixtureData = makeFixtureData();
            fixtureData.runContext = {isPageElementInEditMode: true, pageId: 'pagCustom00000000'};
            const editDriver = new TestDriver(fixtureData);
            expect(editDriver._sdk.getBlockRunContext()).toEqual({
                type: 'pageElementInQueryContainer',
                pageId: 'pagCustom00000000',
                isPageElementInEditMode: true,
            });
        });
    });
});
