import {setGlobalConfigValue} from '../src/private_utils';

describe('setGlobalConfigValue', () => {
    it('sets and deletes deep paths immutably', () => {
        const store = {colors: {primary: 'red'}};
        const withSet = setGlobalConfigValue(store, ['colors', 'accent'], 'blue') as any;
        expect(withSet.colors).toEqual({primary: 'red', accent: 'blue'});
        expect(store.colors).toEqual({primary: 'red'});

        const withDelete = setGlobalConfigValue(withSet, ['colors', 'primary'], undefined) as any;
        expect(withDelete.colors).toEqual({accent: 'blue'});
    });

    it('rejects prototype-polluting path segments', () => {
        for (const key of ['__proto__', 'constructor', 'prototype']) {
            expect(() => setGlobalConfigValue({}, [key, 'x'], 'boom')).toThrow(
                /Invalid globalConfig path segment/,
            );
            expect(() => setGlobalConfigValue({nested: {}}, ['nested', key], 'boom')).toThrow(
                /Invalid globalConfig path segment/,
            );
        }
        expect(({} as any).x).toBeUndefined();
        expect(Object.prototype).not.toHaveProperty('x');
    });
});
