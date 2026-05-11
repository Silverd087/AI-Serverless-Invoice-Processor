import { defineStorage } from '@aws-amplify/backend';
import { processInvoice } from '../functions/process_invoice/resource';

export const storage = defineStorage({
    name: 'invoiceBucket',
    triggers: {
        onUpload: processInvoice,
    },
    access: (allow) => ({
        'uploads/*': [
            allow.entity("identity").to(["read", "write"]),
        ]
    }),
});