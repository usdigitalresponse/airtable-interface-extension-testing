import React, {useState} from 'react';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';
import {
    FieldType,
    type Base,
    type Field,
    type Record as AirtableRecord,
    type Table,
} from '@airtable/blocks/interface/models';

/**
 * Every field type the extension can WRITE, with the documented cell write
 * format produced by its editor:
 *
 * - text-ish types write a string; date/dateTime write an ISO string
 * - number-ish types write a number
 * - checkbox writes a boolean
 * - singleSelect writes {id} (or null to clear)
 * - multipleSelects writes Array<{id}>
 * - multipleRecordLinks writes Array<{id, name}>
 * - multipleAttachments appends {url} to the existing array
 * - singleCollaborator writes {id}; multipleCollaborators writes Array<{id}>
 *
 * Everything else (formula, rollup, count, lookups, barcode, button,
 * auto/created/modified metadata, aiText, externalSyncSource) is read-only
 * per the FieldType docs and rendered as text.
 */

const TEXT_TYPES: ReadonlyArray<string> = [
    FieldType.SINGLE_LINE_TEXT,
    FieldType.MULTILINE_TEXT,
    FieldType.RICH_TEXT,
    FieldType.EMAIL,
    FieldType.URL,
    FieldType.PHONE_NUMBER,
    FieldType.DATE,
    FieldType.DATE_TIME,
];

const NUMBER_TYPES: ReadonlyArray<string> = [
    FieldType.NUMBER,
    FieldType.PERCENT,
    FieldType.CURRENCY,
    FieldType.DURATION,
    FieldType.RATING,
];

/** Text input that commits its value on blur (not per keystroke). */
function CommitInput({
    ariaLabel,
    initial,
    onCommit,
}: {
    ariaLabel: string;
    initial: string;
    onCommit: (value: string) => void;
}) {
    const [draft, setDraft] = useState(initial);
    return (
        <input
            aria-label={ariaLabel}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== initial) {
                    onCommit(draft);
                }
            }}
        />
    );
}

function controlId(record: AirtableRecord, field: Field): string {
    return `${record.id}:${field.id}`;
}

function LinkedRecordsEditor({
    table,
    record,
    field,
}: {
    table: Table;
    record: AirtableRecord;
    field: Field;
}) {
    const base = useBase();
    const options = (field.config as {options: any}).options;
    const linkedTable = base.getTableById(options.linkedTableId);
    const candidates = useRecords(linkedTable);
    const current = (record.getCellValue(field.id) ?? []) as Array<{id: string; name: string}>;
    const currentIds = new Set(current.map((link) => link.id));

    return (
        <span>
            {candidates.map((candidate: AirtableRecord) => (
                <label key={candidate.id}>
                    <input
                        type="checkbox"
                        aria-label={`${controlId(record, field)}:${candidate.id}`}
                        checked={currentIds.has(candidate.id)}
                        onChange={() => {
                            const next = currentIds.has(candidate.id)
                                ? current.filter((link) => link.id !== candidate.id)
                                : [...current, {id: candidate.id, name: candidate.name}];
                            table.updateRecordAsync(record, {[field.id]: next});
                        }}
                    />
                    {candidate.name}
                </label>
            ))}
        </span>
    );
}

/** Render a read-only cell value as text, following the documented read formats. */
export function formatReadOnlyValue(fieldType: string, value: unknown): string {
    if (value === null || value === undefined) {
        return '(empty)';
    }
    switch (fieldType) {
        case FieldType.MULTIPLE_LOOKUP_VALUES:
            return (value as Array<{value: unknown}>)
                .map((entry) => String(entry.value))
                .join(', ');
        case FieldType.BARCODE:
            return (value as {text: string}).text;
        case FieldType.BUTTON:
            return (value as {label: string}).label;
        case FieldType.CREATED_BY:
        case FieldType.LAST_MODIFIED_BY:
            return (value as {name?: string; email: string}).name ?? (value as {email: string}).email;
        case FieldType.AI_TEXT: {
            const aiValue = value as {state: string; value: string};
            return `${aiValue.value} (${aiValue.state})`;
        }
        case FieldType.EXTERNAL_SYNC_SOURCE:
            return (value as {name: string}).name;
        default:
            return String(value);
    }
}

function FieldEditor({
    table,
    record,
    field,
}: {
    table: Table;
    record: AirtableRecord;
    field: Field;
}) {
    const id = controlId(record, field);
    const value = record.getCellValue(field.id);
    const write = (newValue: unknown) => table.updateRecordAsync(record, {[field.id]: newValue});

    if (TEXT_TYPES.includes(field.type)) {
        return (
            <CommitInput
                ariaLabel={id}
                initial={value === null ? '' : String(value)}
                onCommit={(draft) => write(draft === '' ? null : draft)}
            />
        );
    }

    if (NUMBER_TYPES.includes(field.type)) {
        return (
            <CommitInput
                ariaLabel={id}
                initial={value === null ? '' : String(value)}
                onCommit={(draft) => {
                    if (draft === '') {
                        write(null);
                    } else if (!Number.isNaN(Number(draft))) {
                        write(Number(draft));
                    }
                }}
            />
        );
    }

    switch (field.type) {
        case FieldType.CHECKBOX:
            return (
                <input
                    type="checkbox"
                    aria-label={id}
                    checked={value === true}
                    onChange={() => write(value === true ? null : true)}
                />
            );
        case FieldType.SINGLE_SELECT: {
            const choices = (field.config as {options: any}).options.choices as Array<{
                id: string;
                name: string;
            }>;
            const current = value as {id: string} | null;
            return (
                <select
                    aria-label={id}
                    value={current?.id ?? ''}
                    onChange={(event) =>
                        write(event.target.value === '' ? null : {id: event.target.value})
                    }
                >
                    <option value="">(none)</option>
                    {choices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                            {choice.name}
                        </option>
                    ))}
                </select>
            );
        }
        case FieldType.MULTIPLE_SELECTS: {
            const choices = (field.config as {options: any}).options.choices as Array<{
                id: string;
                name: string;
            }>;
            const current = (value ?? []) as Array<{id: string}>;
            const currentIds = new Set(current.map((choice) => choice.id));
            return (
                <span>
                    {choices.map((choice) => (
                        <label key={choice.id}>
                            <input
                                type="checkbox"
                                aria-label={`${id}:${choice.id}`}
                                checked={currentIds.has(choice.id)}
                                onChange={() => {
                                    // Documented write format: Array<{id}>.
                                    const next = currentIds.has(choice.id)
                                        ? current
                                              .filter((entry) => entry.id !== choice.id)
                                              .map((entry) => ({id: entry.id}))
                                        : [...current.map((entry) => ({id: entry.id})), {id: choice.id}];
                                    write(next);
                                }}
                            />
                            {choice.name}
                        </label>
                    ))}
                </span>
            );
        }
        case FieldType.MULTIPLE_RECORD_LINKS:
            return <LinkedRecordsEditor table={table} record={record} field={field} />;
        case FieldType.MULTIPLE_ATTACHMENTS: {
            const attachments = (value ?? []) as Array<{filename?: string; url: string}>;
            return (
                <span>
                    {attachments.map((attachment, index) => (
                        <span key={index}>{attachment.filename ?? attachment.url} </span>
                    ))}
                    <CommitInput
                        ariaLabel={`${id}:add`}
                        initial=""
                        onCommit={(url) => {
                            if (url !== '') {
                                write([...attachments, {url}]);
                            }
                        }}
                    />
                </span>
            );
        }
        case FieldType.SINGLE_COLLABORATOR: {
            const collaborator = value as {id: string; name?: string; email?: string} | null;
            return (
                <span>
                    {collaborator ? `${collaborator.name ?? collaborator.email} ` : ''}
                    <CommitInput
                        ariaLabel={id}
                        initial={collaborator?.id ?? ''}
                        onCommit={(userId) => write(userId === '' ? null : {id: userId})}
                    />
                </span>
            );
        }
        case FieldType.MULTIPLE_COLLABORATORS: {
            const collaborators = (value ?? []) as Array<{id: string; name?: string}>;
            return (
                <span>
                    {collaborators.map((collaborator) => collaborator.name).join(', ')}{' '}
                    <CommitInput
                        ariaLabel={id}
                        initial={collaborators.map((collaborator) => collaborator.id).join(',')}
                        onCommit={(ids) =>
                            write(
                                ids === ''
                                    ? []
                                    : ids.split(',').map((userId) => ({id: userId.trim()})),
                            )
                        }
                    />
                </span>
            );
        }
        default:
            // Read-only types: formula, rollup, count, lookups, barcode,
            // button, autoNumber, createdTime/By, lastModifiedTime/By,
            // aiText, externalSyncSource.
            return <output aria-label={id}>{formatReadOnlyValue(field.type, value)}</output>;
    }
}

function RecordCard({table, record}: {table: Table; record: AirtableRecord}) {
    return (
        <li>
            <h3>{record.name}</h3>
            <dl>
                {table.fields.map((field: Field) => (
                    <div key={field.id}>
                        <dt>
                            {field.name} <code>{field.type}</code>
                        </dt>
                        <dd>
                            <FieldEditor table={table} record={record} field={field} />
                        </dd>
                    </div>
                ))}
            </dl>
        </li>
    );
}

function TableSection({table}: {table: Table}) {
    const records = useRecords(table);
    return (
        <section>
            <h2>
                {table.name} ({records.length} records)
            </h2>
            <ul>
                {records.map((record: AirtableRecord) => (
                    <RecordCard key={record.id} table={table} record={record} />
                ))}
            </ul>
        </section>
    );
}

/**
 * Lists every record of every table in the base and renders a
 * type-appropriate editor (or read-only view) for each field — a workbench
 * covering every {@link FieldType}.
 */
export function FieldTypesApp() {
    const base = useBase();
    return (
        <main>
            <h1>{base.name}: field type workbench</h1>
            {base.tables.map((table: Base['tables'][number]) => (
                <TableSection key={table.id} table={table} />
            ))}
        </main>
    );
}
