import { defineFunction } from "@aws-amplify/backend";

export const invoiceHandler = defineFunction({
    name: "invoiceHandler",
    entry: './handler.ts',
    timeoutSeconds: 60,
    resourceGroupName: 'api-stack'
});