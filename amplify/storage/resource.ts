import { defineStorage } from '@aws-amplify/backend';
import { processInvoice } from "../functions/process_invoice/resource";
export const storage = defineStorage({
    name: 'invoiceBucket',
    access: (allow) => ({
        'invoices/{user_id}/*': [
            allow.entity("identity").to(["read", "write"]),
            allow.resource(processInvoice).to(["read"])
        ]
    }),
    triggers: {
        onUpload: processInvoice
    }
});