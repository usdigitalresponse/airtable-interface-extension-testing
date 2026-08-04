/**
 * Conversion from Airtable REST API shapes to the testing library's
 * FixtureData. The REST API and the SDK's internal cell-value format agree
 * for most field types; the exceptions handled here:
 *
 * - single/multiple selects: REST returns choice NAMES; the SDK stores choice
 *   objects ({id, name, color}) resolved from the field's schema options.
 * - multipleRecordLinks: REST returns record-id strings; the SDK stores
 *   {id, name} pairs. Names are resolved from the linked table's exported
 *   records (primary cell value) when that table is part of the export.
 *
 * Everything else (text, numbers, checkboxes, dates, collaborators,
 * attachments, computed values, …) passes through unchanged. Unrecognized
 * shapes emit a warning naming the field so surprises are visible.
 */
import {type FixtureData, type TableFixtureData} from '@usdr/airtable-interface-testing';
import {type ApiFieldSchema, type ApiRecord, type ApiTableSchema} from './airtable_api';

export interface TableExport {
    schema: ApiTableSchema;
    /** Fields to include, in schema order. Must include the primary field. */
    fieldIds: ReadonlyArray<string>;
    records: ReadonlyArray<ApiRecord>;
}

interface SelectChoice {
    id: string;
    name: string;
    color?: string;
}

function choicesByName(field: ApiFieldSchema): Map<string, SelectChoice> {
    const result = new Map<string, SelectChoice>();
    const choices = (field.options as {choices?: Array<SelectChoice>} | undefined)?.choices ?? [];
    for (const choice of choices) {
        result.set(choice.name, choice);
    }
    return result;
}

export function buildFixtureData(
    base: {id: string; name: string},
    tableExports: ReadonlyArray<TableExport>,
): {fixtureData: FixtureData; warnings: Array<string>} {
    const warnings: Array<string> = [];
    const warned = new Set<string>();
    const warnOnce = (key: string, message: string) => {
        if (!warned.has(key)) {
            warned.add(key);
            warnings.push(message);
        }
    };

    // Primary-cell names for linked-record resolution, per exported table.
    const recordNamesByTableId = new Map<string, Map<string, string>>();
    for (const {schema, records} of tableExports) {
        const names = new Map<string, string>();
        for (const record of records) {
            const primaryValue = record.fields[schema.primaryFieldId];
            names.set(record.id, primaryValue === undefined ? record.id : String(primaryValue));
        }
        recordNamesByTableId.set(schema.id, names);
    }

    const convertCellValue = (
        tableName: string,
        field: ApiFieldSchema,
        value: unknown,
    ): unknown => {
        switch (field.type) {
            case 'singleSelect': {
                if (typeof value !== 'string') {
                    return value;
                }
                const choice = choicesByName(field).get(value);
                if (!choice) {
                    warnOnce(
                        `choice:${field.id}:${value}`,
                        `${tableName}.${field.name}: select choice "${value}" not found in field options; kept as a plain string`,
                    );
                    return value;
                }
                return choice;
            }
            case 'multipleSelects': {
                if (!Array.isArray(value)) {
                    return value;
                }
                const byName = choicesByName(field);
                return value.map((name) => {
                    if (typeof name !== 'string') {
                        return name;
                    }
                    const choice = byName.get(name);
                    if (!choice) {
                        warnOnce(
                            `choice:${field.id}:${name}`,
                            `${tableName}.${field.name}: select choice "${name}" not found in field options; kept as a plain string`,
                        );
                        return name;
                    }
                    return choice;
                });
            }
            case 'multipleLookupValues': {
                // The REST API flattens lookups to a plain array of values,
                // losing which linked record each value came from — so the
                // SDK's documented read format (Array<{linkedRecordId,
                // value}>) cannot be reconstructed here.
                warnOnce(
                    `lookup:${field.id}`,
                    `${tableName}.${field.name}: lookup values export in the REST API's flat-array shape; the SDK documents Array<{linkedRecordId, value}> — hand-edit the fixture if your extension reads linkedRecordId`,
                );
                return value;
            }
            case 'multipleRecordLinks': {
                if (!Array.isArray(value)) {
                    return value;
                }
                const linkedTableId = (field.options as {linkedTableId?: string} | undefined)
                    ?.linkedTableId;
                const linkedNames = linkedTableId
                    ? recordNamesByTableId.get(linkedTableId)
                    : undefined;
                if (linkedTableId && !linkedNames) {
                    warnOnce(
                        `link:${field.id}`,
                        `${tableName}.${field.name}: linked table ${linkedTableId} is not part of this export; linked record names fall back to record ids`,
                    );
                }
                return value.map((item) => {
                    if (typeof item === 'string') {
                        return {id: item, name: linkedNames?.get(item) ?? item};
                    }
                    // Some responses already include {id, name}.
                    if (item && typeof item === 'object' && 'id' in item) {
                        return item;
                    }
                    warnOnce(
                        `linkshape:${field.id}`,
                        `${tableName}.${field.name}: unrecognized linked-record value shape; kept as-is`,
                    );
                    return item;
                });
            }
            default:
                return value;
        }
    };

    const tables: Array<TableFixtureData> = tableExports.map(({schema, fieldIds, records}) => {
        const fieldIdSet = new Set(fieldIds);
        if (!fieldIdSet.has(schema.primaryFieldId)) {
            throw new Error(
                `Table "${schema.name}": the primary field (${schema.primaryFieldId}) must be included in the export`,
            );
        }

        // The fixture format derives the primary field from position: it must
        // come first. Preserve schema order for the rest.
        const selectedFields = schema.fields.filter((field) => fieldIdSet.has(field.id));
        const orderedFields = [
            ...selectedFields.filter((field) => field.id === schema.primaryFieldId),
            ...selectedFields.filter((field) => field.id !== schema.primaryFieldId),
        ];
        const fieldsById = new Map(orderedFields.map((field) => [field.id, field]));

        return {
            id: schema.id,
            name: schema.name,
            description: schema.description ?? null,
            fields: orderedFields.map((field) => ({
                id: field.id,
                name: field.name,
                description: field.description ?? null,
                type: field.type,
                // The SDK's mock fieldTypeProvider passes typeOptions through
                // as FieldConfig.options, so REST meta options are stored
                // unchanged.
                options: field.options ?? null,
            })),
            records: records.map((record) => ({
                id: record.id,
                createdTime: record.createdTime,
                cellValuesByFieldId: Object.fromEntries(
                    Object.entries(record.fields)
                        .filter(([fieldId]) => fieldIdSet.has(fieldId))
                        .map(([fieldId, value]) => {
                            const field = fieldsById.get(fieldId);
                            return [
                                fieldId,
                                field ? convertCellValue(schema.name, field, value) : value,
                            ];
                        }),
                ),
            })),
        };
    });

    return {
        fixtureData: {
            base: {
                id: base.id,
                name: base.name,
                tables,
            },
        },
        warnings,
    };
}
