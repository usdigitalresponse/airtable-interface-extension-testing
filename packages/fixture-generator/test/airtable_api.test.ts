import {AirtableApi, AirtableApiError} from '../src/airtable_api';

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

describe('AirtableApi', () => {
    it('paginates the base list', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    bases: [{id: 'app1', name: 'One', permissionLevel: 'create'}],
                    offset: 'next',
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({bases: [{id: 'app2', name: 'Two', permissionLevel: 'read'}]}),
            );
        const api = new AirtableApi('patX', fetchMock as unknown as typeof fetch);

        const bases = await api.listBasesAsync();
        expect(bases.map((base) => base.id)).toEqual(['app1', 'app2']);
        expect(fetchMock.mock.calls[1][0]).toContain('offset=next');
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer patX');
    });

    it('requests records keyed by field id, with field selection and pagination', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    records: [{id: 'rec1', createdTime: 't', fields: {fldA: 'x'}}],
                    offset: 'more',
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({records: [{id: 'rec2', createdTime: 't', fields: {fldA: 'y'}}]}),
            );
        const api = new AirtableApi('patX', fetchMock as unknown as typeof fetch);

        const records = await api.listRecordsAsync('appZ', 'tblZ', {fieldIds: ['fldA']});
        expect(records.map((record) => record.id)).toEqual(['rec1', 'rec2']);

        const firstUrl = String(fetchMock.mock.calls[0][0]);
        expect(firstUrl).toContain('/v0/appZ/tblZ');
        expect(firstUrl).toContain('returnFieldsByFieldId=true');
        expect(firstUrl).toContain('fields%5B%5D=fldA');
    });

    it('caps records at maxRecords', async () => {
        const fetchMock = jest.fn().mockResolvedValueOnce(
            jsonResponse({
                records: [
                    {id: 'rec1', createdTime: 't', fields: {}},
                    {id: 'rec2', createdTime: 't', fields: {}},
                ],
                offset: 'ignored',
            }),
        );
        const api = new AirtableApi('patX', fetchMock as unknown as typeof fetch);

        const records = await api.listRecordsAsync('appZ', 'tblZ', {maxRecords: 2});
        expect(records).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain('maxRecords=2');
    });

    it('surfaces auth errors with scope guidance', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(jsonResponse({error: {message: 'Invalid token'}}, 401));
        const api = new AirtableApi('patBad', fetchMock as unknown as typeof fetch);

        await expect(api.listBasesAsync()).rejects.toThrow(/schema\.bases:read/);
        await expect(api.listBasesAsync()).rejects.toBeInstanceOf(AirtableApiError);
    });
});
