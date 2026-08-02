import React from 'react';
import {initializeBlock} from '@airtable/blocks/interface/ui';
import {FieldTypesApp} from './app';

// Tests never import this module — they render <FieldTypesApp /> inside
// TestDriver.Container instead.
initializeBlock({interface: () => <FieldTypesApp />});
