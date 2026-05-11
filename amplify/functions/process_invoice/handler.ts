import type { Handler, S3Event } from 'aws-lambda';
import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
const REGION = process.env.AWS_REGION!;
const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT!;

const textractClient = new TextractClient({ region: REGION });
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const s3 = new S3Client({});
async function appsyncRequest(query: string, variables?: object) {
    const url = new URL(APPSYNC_ENDPOINT);
    const body = JSON.stringify({ query, variables });

    const signer = new SignatureV4({
        credentials: defaultProvider(),
        region: REGION,
        service: "appsync",
        sha256: Sha256,
    });

    const signed = await signer.sign({
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        protocol: "https",
        headers: { host: url.hostname, "content-type": "application/json" },
        body,
    });

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: signed.headers as Record<string, string>,
        body,
    });

    const result = await response.json() as { data?: any; errors?: any };
    if (result.errors) throw new Error(JSON.stringify(result.errors));
    return result.data;
}

export const handler: Handler = async (event: S3Event) => {
    for (const record of event.Records) {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        let invoiceId: string | undefined;
        const parts = objectKey.split('/');
        const owner = parts[1]; 
        try {
            const createData = await appsyncRequest(`
        mutation CreateInvoice($input: CreateInvoiceInput!) {
          createInvoice(input: $input) { id }
        }
      `, { input: { owner: owner, s3Key: objectKey, status: "PROCESSING" } });

            invoiceId = createData.createInvoice.id;
            if (!invoiceId) throw new Error("Failed to create invoice record");

            const textractResponse = await textractClient.send(new AnalyzeDocumentCommand({
                Document: { S3Object: { Bucket: bucketName, Name: objectKey } },
                FeatureTypes: ["TABLES", "FORMS"],
            }));

            const text = textractResponse.Blocks
                ?.filter((b) => b.BlockType === "LINE")
                .map((b) => b.Text)
                .join("\n");

            const prompt = `
        You are an expert invoice extraction assistant. Extract structured data from the invoice text below.
        Return ONLY a valid JSON object with these fields:
        {
          "vendor": "string",
          "vendor_address": "string",
          "vendor_email": "string",
          "vendor_phone": "string",
          "amount": 0.0,
          "subtotal": 0.0,
          "tax_amount": 0.0,
          "currency": "USD",
          "date": "YYYY-MM-DD",
          "due_date": "YYYY-MM-DD",
          "invoice_number": "string",
          "po_number": "string",
          "payment_terms": "string",
          "notes": "string",
          "confidence": 0.0,
          "line_items": [{ "description": "string", "quantity": 0.0, "unit_price": 0.0, "total": 0.0 }]
        }
        Currency must be exactly "USD" or "CAD".
        Invoice text:
        ${text}
      `;

            const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
                contentType: "application/json",
                accept: "application/json",
                modelId: "anthropic.claude-3-haiku-20240307-v1:0",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 1000,
                    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
                }),
            }));

            const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
            const result = JSON.parse(responseBody.content[0].text);

            await appsyncRequest(`
        mutation UpdateInvoice($input: UpdateInvoiceInput!) {
          updateInvoice(input: $input) { id }
        }
      `, {
                input: {
                    id: invoiceId,
                    status: "COMPLETED",
                    vendor: result.vendor,
                    amount: result.amount,
                    date: result.date ? new Date(result.date).toISOString() : null,
                    due_date: result.due_date ? new Date(result.due_date).toISOString() : null,
                    currency: result.currency,
                    invoice_number: result.invoice_number,
                    po_number: result.po_number,
                    tax_amount: result.tax_amount,
                    subtotal: result.subtotal,
                    payment_terms: result.payment_terms,
                    notes: result.notes,
                    confidence: result.confidence,
                    vendor_address: result.vendor_address,
                    vendor_email: result.vendor_email,
                    vendor_phone: result.vendor_phone,
                    filename: objectKey.split("/").pop(),
                    processed_at: new Date().toISOString(),
                },
            });

        } catch (error) {
            console.error("Error processing invoice:", error);
            if (invoiceId) {
                await appsyncRequest(`
          mutation UpdateInvoice($input: UpdateInvoiceInput!) {
            updateInvoice(input: $input) { id }
          }
        `, { input: { id: invoiceId, status: "FAILED" } });
            }
            throw error;
        }
    }
};