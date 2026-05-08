import { defineStorage } from '@aws-amplify/backend';
import { processInvoice } from "../functions/process_invoice/resource";
import { invoiceHandler } from '../functions/invoice_handler/resource';
export const storage = defineStorage({
    name: 'invoiceBucket',
    access: (allow) => ({
        'invoices/*': [
            allow.entity("identity").to(["read", "write"]),
            allow.resource(processInvoice).to(["read"]),
            allow.resource(invoiceHandler).to(['read', 'write'])
        ]
    }),
    triggers: {
        onUpload: processInvoice
    }
});