import { defineFunction } from '@aws-amplify/backend';

export const sayHello = defineFunction({
    name: 'process-invoice',
    entry: './handler.ts',
});