import { defineFunction } from '@aws-amplify/backend';

export const processInvoice = defineFunction({
    name: 'process-invoice',
    entry: './handler.ts',
});