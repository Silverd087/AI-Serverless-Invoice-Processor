import { defineStorage } from '@aws-amplify/backend';
export const storage = defineStorage({
    name: 'invoiceBucket',
    access: (allow) => ({
        'invoices/*': [
            allow.entity("identity").to(["read", "write"]),
        ]
    }),
    
});