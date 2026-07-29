import {VacantAirtableInterface} from '../src/vacant_airtable_interface';

describe('injection', () => {
    it('installs a vacant interface on the global before SDK import', () => {
        const getter = (window as any).__getAirtableInterfaceAtVersion;
        expect(typeof getter).toBe('function');
        expect(getter()).toBeInstanceOf(VacantAirtableInterface);
        expect(getter()).toBe(getter());
    });

    it('vacant interface describes an empty base in a page-element run context', () => {
        const vacant = new VacantAirtableInterface();
        expect(vacant.sdkInitData.baseData.tableOrder).toEqual([]);
        expect(vacant.sdkInitData.runContext.type).toBe('pageElementInQueryContainer');
    });

    it('vacant interface rejects host communication with a descriptive error', () => {
        const vacant = new VacantAirtableInterface();
        expect(() => vacant.applyMutationAsync()).toThrow(/TestDriver/);
        expect(() => vacant.expandRecord()).toThrow(/TestDriver/);
        expect(() => vacant.setSearchParamsAsync()).toThrow(/TestDriver/);
        expect(() => vacant.setCustomPropertiesAsync()).toThrow(/TestDriver/);
        expect(() => vacant.setSelectedSubElementAsync()).toThrow(/TestDriver/);
        expect(() => vacant.reloadFrame()).toThrow(/TestDriver/);
    });
});
