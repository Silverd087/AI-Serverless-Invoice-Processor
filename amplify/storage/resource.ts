import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'invoiceBucket',
    access: (allow) => ({
        'invoices/{user_id}/*': [
            allow.entity("identity").to(["read", "write"])
        ]
    }),
});