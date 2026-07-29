import React, {useCallback, useState} from 'react';
import {
    expandRecord,
    useBase,
    useCustomProperties,
    useRecords,
    useSearchParams,
} from '@airtable/blocks/interface/ui';
import {type Base, type Field, type Record as AirtableRecord} from '@airtable/blocks/interface/models';

/**
 * Custom properties surfaced in the interface designer's properties panel:
 * a title for the widget and which checkbox field marks a task as done.
 */
export function getCustomProperties(base: Base) {
    const table = base.tables[0];
    return [
        {key: 'title', label: 'Title', type: 'string' as const, defaultValue: 'Tasks'},
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

/**
 * A to-do list over the first table in the base. Supports adding, toggling
 * (via the configured "done" checkbox field), deleting, and expanding
 * records; the `filter` search param narrows the list to open or done tasks.
 */
export function TodoApp() {
    const base = useBase();
    const table = base.tables[0];
    const records = useRecords(table);
    const {searchParams} = useSearchParams();
    const {customPropertyValueByKey} = useCustomProperties(getCustomProperties);
    const [draftName, setDraftName] = useState('');

    const title = String(customPropertyValueByKey.title ?? 'Tasks');
    const doneField = customPropertyValueByKey.doneField as Field | undefined;
    const primaryField = table.fields[0];

    const filter = searchParams.filter ?? 'all';
    const visibleRecords = records.filter((record: AirtableRecord) => {
        if (filter === 'all' || !doneField) {
            return true;
        }
        const isDone = Boolean(record.getCellValue(doneField.id));
        return filter === 'done' ? isDone : !isDone;
    });

    const canCreate = table.hasPermissionToCreateRecord();
    const canDelete = table.hasPermissionToDeleteRecord();

    const addTask = useCallback(async () => {
        if (!draftName) {
            return;
        }
        await table.createRecordAsync({[primaryField.id]: draftName});
        setDraftName('');
    }, [table, primaryField, draftName]);

    return (
        <div>
            <h1>{title}</h1>
            <div>
                <input
                    aria-label="New task name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                />
                <button disabled={!canCreate} onClick={addTask}>
                    Add task
                </button>
            </div>
            <ul>
                {visibleRecords.map((record: AirtableRecord) => {
                    const isDone = doneField
                        ? Boolean(record.getCellValue(doneField.id))
                        : false;
                    return (
                        <li key={record.id}>
                            {doneField ? (
                                <input
                                    type="checkbox"
                                    aria-label={`Toggle ${record.name}`}
                                    checked={isDone}
                                    onChange={() =>
                                        table.updateRecordAsync(record, {
                                            [doneField.id]: !isDone,
                                        })
                                    }
                                />
                            ) : null}
                            <span>
                                {record.name}
                                {isDone ? ' (done)' : ''}
                            </span>
                            <button onClick={() => expandRecord(record)}>Expand</button>
                            <button
                                disabled={!canDelete}
                                onClick={() => table.deleteRecordAsync(record)}
                            >
                                Delete
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
