import {convertFixtureDataToSdkInitData} from '../src/fixture_data';
import {makeFixtureData, NAME_FIELD_ID, TASKS_TABLE_ID} from './fixtures';

describe('convertFixtureDataToSdkInitData', () => {
    it('produces SdkInitData with records embedded in table data', () => {
        const initData = convertFixtureDataToSdkInitData(makeFixtureData());

        expect(initData.runContext.type).toBe('pageElementInQueryContainer');
        const tableData = initData.baseData.tablesById[TASKS_TABLE_ID];
        expect(tableData.primaryFieldId).toBe(NAME_FIELD_ID);
        expect(tableData.recordOrder).toEqual(['recTaskAlpha00000', 'recTaskBeta000000']);
        expect(Object.keys(tableData.recordsById)).toHaveLength(2);
        expect(initData.initialKvValuesByKey).toEqual({greeting: 'hello'});
        expect(initData.initialSearchParams).toEqual({status: 'open'});
    });

    it('defaults collaborators, color, and permission level', () => {
        const fixtureData = makeFixtureData();
        const initData = convertFixtureDataToSdkInitData(fixtureData);

        expect(initData.baseData.currentUserId).toBe('usrtestdriver0000');
        expect(initData.baseData.activeCollaboratorIds).toEqual(['usrtestdriver0000']);
        expect(initData.baseData.color).toBe('purple');
        expect(initData.baseData.permissionLevel).toBe('create');
    });

    it('honors explicit collaborators and permission level', () => {
        const fixtureData = makeFixtureData();
        fixtureData.base.collaborators = [
            {id: 'usrOwner000000000', name: 'Owner', email: 'o@example.com', isActive: true},
            {id: 'usrOther000000000', name: 'Other', email: 'x@example.com', isActive: false},
        ];
        fixtureData.base.permissionLevel = 'read';
        const initData = convertFixtureDataToSdkInitData(fixtureData);

        expect(initData.baseData.currentUserId).toBe('usrOwner000000000');
        expect(initData.baseData.activeCollaboratorIds).toEqual(['usrOwner000000000']);
        expect(initData.baseData.permissionLevel).toBe('read');
    });

    it('populates allTableDataForEditModeConfiguration for useCustomProperties', () => {
        const initData = convertFixtureDataToSdkInitData(makeFixtureData());
        const editModeData = initData.baseData.allTableDataForEditModeConfiguration;
        expect(editModeData).toBeDefined();
        expect(editModeData![TASKS_TABLE_ID].primaryFieldId).toBe(NAME_FIELD_ID);
    });

    it('rejects fixture data without tables', () => {
        const fixtureData = makeFixtureData();
        fixtureData.base.tables = [];
        expect(() => convertFixtureDataToSdkInitData(fixtureData)).toThrow(
            /at least one table/,
        );
    });

    it('rejects tables without fields', () => {
        const fixtureData = makeFixtureData();
        fixtureData.base.tables[0].fields = [];
        expect(() => convertFixtureDataToSdkInitData(fixtureData)).toThrow(
            /at least one field/,
        );
    });

    it('rejects duplicate table, field, and record ids', () => {
        const duplicateTable = makeFixtureData();
        duplicateTable.base.tables.push(duplicateTable.base.tables[0]);
        expect(() => convertFixtureDataToSdkInitData(duplicateTable)).toThrow(
            /repeated table ID/,
        );

        const duplicateField = makeFixtureData();
        duplicateField.base.tables[0].fields.push(duplicateField.base.tables[0].fields[0]);
        expect(() => convertFixtureDataToSdkInitData(duplicateField)).toThrow(
            /repeated field ID/,
        );

        const duplicateRecord = makeFixtureData();
        duplicateRecord.base.tables[0].records.push(duplicateRecord.base.tables[0].records[0]);
        expect(() => convertFixtureDataToSdkInitData(duplicateRecord)).toThrow(
            /repeated record ID/,
        );
    });
});
