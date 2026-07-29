/**
 * Minimal Airtable REST API client covering the two surfaces the generator
 * needs: the Meta API (base list + schema) and the records API. Requires a
 * Personal Access Token with `schema.bases:read` and `data.records:read`
 * scopes.
 */

const API_ROOT = 'https://api.airtable.com/v0';

export interface ApiBase {
    id: string;
    name: string;
    permissionLevel: string;
}

export interface ApiFieldSchema {
    id: string;
    name: string;
    description?: string;
    type: string;
    options?: {[key: string]: unknown};
}

export interface ApiTableSchema {
    id: string;
    name: string;
    description?: string;
    primaryFieldId: string;
    fields: Array<ApiFieldSchema>;
}

export interface ApiRecord {
    id: string;
    createdTime: string;
    fields: {[fieldId: string]: unknown};
}

export class AirtableApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export class AirtableApi {
    private readonly _token: string;
    private readonly _fetch: typeof fetch;

    constructor(token: string, fetchImpl: typeof fetch = fetch) {
        this._token = token;
        this._fetch = fetchImpl;
    }

    private async _getAsync(pathname: string, searchParams?: URLSearchParams): Promise<any> {
        const url = new URL(`${API_ROOT}${pathname}`);
        if (searchParams) {
            url.search = searchParams.toString();
        }
        const response = await this._fetch(url.toString(), {
            headers: {Authorization: `Bearer ${this._token}`},
        });
        if (!response.ok) {
            let detail: string;
            try {
                const body = await response.json();
                detail = body?.error?.message ?? JSON.stringify(body);
            } catch {
                detail = await response.text().catch(() => '');
            }
            if (response.status === 401 || response.status === 403) {
                throw new AirtableApiError(
                    response.status,
                    `Airtable rejected the token (HTTP ${response.status}): ${detail}. ` +
                        'The token needs the schema.bases:read and data.records:read scopes ' +
                        'and access to the base. Re-run with --reset-token to enter a new one.',
                );
            }
            throw new AirtableApiError(
                response.status,
                `Airtable API request failed (HTTP ${response.status}): ${detail}`,
            );
        }
        return response.json();
    }

    /** List all bases the token can access (paginated). */
    async listBasesAsync(): Promise<Array<ApiBase>> {
        const bases: Array<ApiBase> = [];
        let offset: string | undefined;
        do {
            const params = new URLSearchParams();
            if (offset) {
                params.set('offset', offset);
            }
            const body = await this._getAsync('/meta/bases', params);
            bases.push(...body.bases);
            offset = body.offset;
        } while (offset);
        return bases;
    }

    /** Fetch the full schema for a base. */
    async getBaseSchemaAsync(baseId: string): Promise<Array<ApiTableSchema>> {
        const body = await this._getAsync(`/meta/bases/${baseId}/tables`);
        return body.tables;
    }

    /**
     * Fetch records for one table (paginated), keyed by field id. `fieldIds`
     * limits the returned cell values; `maxRecords` caps the total.
     */
    async listRecordsAsync(
        baseId: string,
        tableId: string,
        {fieldIds, maxRecords}: {fieldIds?: ReadonlyArray<string>; maxRecords?: number} = {},
    ): Promise<Array<ApiRecord>> {
        const records: Array<ApiRecord> = [];
        let offset: string | undefined;
        do {
            const params = new URLSearchParams();
            // FixtureData keys cell values by field id.
            params.set('returnFieldsByFieldId', 'true');
            params.set('pageSize', '100');
            if (maxRecords !== undefined) {
                params.set('maxRecords', String(maxRecords));
            }
            for (const fieldId of fieldIds ?? []) {
                params.append('fields[]', fieldId);
            }
            if (offset) {
                params.set('offset', offset);
            }
            const body = await this._getAsync(`/${baseId}/${tableId}`, params);
            records.push(...body.records);
            offset = body.offset;
        } while (offset && (maxRecords === undefined || records.length < maxRecords));
        return maxRecords === undefined ? records : records.slice(0, maxRecords);
    }
}
