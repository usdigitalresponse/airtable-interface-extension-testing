/**
 * Smoke test against the built artifact (dist/index.cjs) rather than src/,
 * proving the shipped package works under a consumer-style Jest setup. Run
 * `npm run build` before this suite (it is skipped when dist/ is absent).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';

const distPath = path.join(__dirname, '..', 'dist', 'index.cjs');
const describeIfBuilt = fs.existsSync(distPath) ? describe : describe.skip;

describeIfBuilt('built dist artifact', () => {
    const {TestDriver} = require(distPath);

    function List() {
        const base = useBase();
        const records = useRecords(base.getTableByName('Items'));
        return (
            <ul>
                {records.map((record: any) => (
                    <li key={record.id}>{String(record.getCellValue('fldItemName000000'))}</li>
                ))}
            </ul>
        );
    }

    it('renders and mutates through the built TestDriver', async () => {
        const driver = new TestDriver({
            base: {
                id: 'appDistSmoke00000',
                name: 'Dist smoke',
                tables: [
                    {
                        id: 'tblItems000000000',
                        name: 'Items',
                        fields: [{id: 'fldItemName000000', name: 'Name', type: 'singleLineText'}],
                        records: [
                            {
                                id: 'recItemOne0000000',
                                cellValuesByFieldId: {fldItemName000000: 'First item'},
                            },
                        ],
                    },
                ],
            },
        });

        render(
            <driver.Container>
                <List />
            </driver.Container>,
        );
        expect(await screen.findByText('First item')).toBeInTheDocument();

        await act(async () => {
            await driver.base
                .getTableByName('Items')
                .createRecordAsync({fldItemName000000: 'Second item'});
        });
        expect(await screen.findByText('Second item')).toBeInTheDocument();
    });
});
