import React from 'react';
import {initializeBlock} from '@airtable/blocks/interface/ui';
import {TodoApp} from './app';

// Tests never import this module — they render <TodoApp /> inside
// TestDriver.Container instead. This entry point is only used when the
// extension runs for real (block run / block release).
initializeBlock({interface: () => <TodoApp />});
