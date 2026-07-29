/**
 * Fixture ID anonymization: replaces real Airtable IDs with readable,
 * deterministic IDs derived from the names of the things they identify —
 * `app1x2y3z...` for a base named "Test base name" becomes `appTestBaseName`.
 *
 * Rules:
 * - The three-letter prefix (app/tbl/fld/rec/sel) is kept.
 * - The remainder is the UpperCamelCase name, truncated so the whole ID is at
 *   most 17 characters (Airtable's ID length).
 * - Name collisions within a prefix get a numeric suffix from the second
 *   occurrence on (fldName, fldName2, fldName3, …), truncating the name
 *   further so the suffix still fits in 17.
 *
 * All references are rewritten consistently: table/field/record/choice IDs
 * where they are defined, `cellValuesByFieldId` keys, linked-record and
 * select cell values ({id, …}), and field options that point at other IDs
 * (`linkedTableId`, `inverseLinkFieldId`).
 */
import {type FieldFixtureData, type FixtureData} from '@usdr/airtable-interface-testing';

const MAX_ID_LENGTH = 17;
const PREFIX_LENGTH = 3;

function camelCaseName(name: string): string {
    const words = name
        .split(/[^a-zA-Z0-9]+/)
        .filter((word) => word.length > 0)
        .map((word) => word[0].toUpperCase() + word.slice(1));
    return words.join('');
}

/**
 * Allocates readable IDs for one prefix namespace, handling truncation and
 * collision numbering.
 */
class IdAllocator {
    private readonly _prefix: string;
    private readonly _used = new Set<string>();

    constructor(prefix: string) {
        this._prefix = prefix;
    }

    allocate(name: string, fallback: string): string {
        const camel = camelCaseName(name) || fallback;
        const budget = MAX_ID_LENGTH - PREFIX_LENGTH;

        const first = this._prefix + camel.slice(0, budget);
        if (!this._used.has(first)) {
            this._used.add(first);
            return first;
        }

        for (let n = 2; ; n++) {
            const suffix = String(n);
            const candidate =
                this._prefix + camel.slice(0, budget - suffix.length) + suffix;
            if (!this._used.has(candidate)) {
                this._used.add(candidate);
                return candidate;
            }
        }
    }
}

type IdMap = Map<string, string>;

function remapSelectOptions(field: FieldFixtureData, choiceIds: IdMap): void {
    const choices = (field.options as {choices?: Array<{id?: string; name?: string}>} | null)
        ?.choices;
    if (!choices) {
        return;
    }
    const allocator = new IdAllocator('sel');
    for (const choice of choices) {
        if (typeof choice.id === 'string') {
            const newId = allocator.allocate(choice.name ?? '', 'Choice');
            choiceIds.set(choice.id, newId);
            choice.id = newId;
        }
    }
}

function remapCellValue(
    fieldType: string,
    value: unknown,
    recordIds: IdMap,
    choiceIds: IdMap,
): unknown {
    const remapIdObject = (item: unknown, map: IdMap): unknown => {
        if (item && typeof item === 'object' && 'id' in item) {
            const withId = item as {id: unknown};
            if (typeof withId.id === 'string' && map.has(withId.id)) {
                return {...item, id: map.get(withId.id)};
            }
        }
        return item;
    };

    switch (fieldType) {
        case 'singleSelect':
            return remapIdObject(value, choiceIds);
        case 'multipleSelects':
            return Array.isArray(value)
                ? value.map((item) => remapIdObject(item, choiceIds))
                : value;
        case 'multipleRecordLinks':
            return Array.isArray(value)
                ? value.map((item) => remapIdObject(item, recordIds))
                : value;
        default:
            return value;
    }
}

/**
 * Returns a copy of the fixture data with all IDs anonymized. The input is
 * not modified.
 */
export function anonymizeFixtureData(fixtureData: FixtureData): FixtureData {
    const result: FixtureData = JSON.parse(JSON.stringify(fixtureData));

    const tableAllocator = new IdAllocator('tbl');
    const fieldAllocator = new IdAllocator('fld');
    const recordAllocator = new IdAllocator('rec');

    const tableIds: IdMap = new Map();
    const fieldIds: IdMap = new Map();
    const recordIds: IdMap = new Map();
    const choiceIds: IdMap = new Map();

    result.base.id = new IdAllocator('app').allocate(result.base.name, 'Base');

    // Pass 1: allocate every ID (records need names from primary cells, and
    // cross-table references need complete maps before rewriting).
    for (const table of result.base.tables) {
        tableIds.set(table.id, tableAllocator.allocate(table.name, 'Table'));
        for (const field of table.fields) {
            fieldIds.set(field.id, fieldAllocator.allocate(field.name, 'Field'));
            remapSelectOptions(field, choiceIds);
        }
        const primaryFieldId = table.fields[0].id;
        for (const record of table.records) {
            const primaryValue = record.cellValuesByFieldId[primaryFieldId];
            const name =
                primaryValue === undefined || primaryValue === null ? '' : String(primaryValue);
            recordIds.set(record.id, recordAllocator.allocate(name, 'Record'));
        }
    }

    // Pass 2: rewrite definitions and references.
    for (const table of result.base.tables) {
        table.id = tableIds.get(table.id)!;
        for (const field of table.fields) {
            field.id = fieldIds.get(field.id)!;
            const options = field.options as
                | {linkedTableId?: string; inverseLinkFieldId?: string}
                | null;
            if (options?.linkedTableId && tableIds.has(options.linkedTableId)) {
                options.linkedTableId = tableIds.get(options.linkedTableId)!;
            }
            if (options?.inverseLinkFieldId && fieldIds.has(options.inverseLinkFieldId)) {
                options.inverseLinkFieldId = fieldIds.get(options.inverseLinkFieldId)!;
            }
        }
        const fieldTypesByNewId = new Map(
            table.fields.map((field) => [field.id, field.type]),
        );
        for (const record of table.records) {
            record.id = recordIds.get(record.id)!;
            record.cellValuesByFieldId = Object.fromEntries(
                Object.entries(record.cellValuesByFieldId).map(([fieldId, value]) => {
                    const newFieldId = fieldIds.get(fieldId) ?? fieldId;
                    return [
                        newFieldId,
                        remapCellValue(
                            fieldTypesByNewId.get(newFieldId) ?? '',
                            value,
                            recordIds,
                            choiceIds,
                        ),
                    ];
                }),
            );
        }
    }

    return result;
}
