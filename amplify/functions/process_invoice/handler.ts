import type { Handler, S3Event } from 'aws-lambda';
import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
import {
    BedrockRuntimeClient,
    InvokeModelCommand,

} from "@aws-sdk/client-bedrock-runtime";
import type { Schema } from "../../data/resource";
import { generateClient } from 'aws-amplify/data';

const config = { region: "us-east-1" }
const textractClient = new TextractClient(config)
const bedrockClient = new BedrockRuntimeClient(config)
const client = generateClient<Schema>()

export const handler: Handler = async (event: S3Event) => {

    for (const record of event.Records) {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        let invoiceId: string | undefined
        try {
            const { data: newInvoice } = await client.models.Invoice.create(
                {
                    s3Key: objectKey,
                    status: "PROCESSING",

                }
            )
            if (!newInvoice) throw new Error("Failed to create record")
            else {
                invoiceId = newInvoice.id
            }

            const textractCommand = new AnalyzeDocumentCommand({
                Document: {
                    S3Object: {
                        Bucket: bucketName,
                        Name: objectKey
                    }
                },
                FeatureTypes: ["TABLES", "FORMS", "QUERIES"]
            })
            const response = await textractClient.send(textractCommand)


            const text = response.Blocks?.filter((block) => block.BlockType == "LINE").map(block => block.Text).join("\n")


            const prompt = `
            You are an expert invoice extraction assistant. Your task is to extract structured data from the provided invoice text.

            ### Extraction Requirements:
            1. **Vendor Info**: Extract Name, Address, Email, and Phone.
            2. **Financials**: Extract Subtotal, Tax Amount, and Total Amount (as floats).
            3. **Identifiers**: Extract Invoice Number and PO Number.
            4. **Dates**: Extract Invoice Date and Due Date in ISO 8601 format (YYYY-MM-DD).
            5. **Currency**: Must be exactly one of: "USD" or "CAD".
            6. **Line Items**: For every item, extract Description, Quantity, Unit Price, and Total.
            7. **Metadata**: Provide a confidence score between 0 and 1 based on text clarity.

            ### Output Format:
            Return ONLY a valid JSON object. Do not include any conversational text or markdown blocks. The JSON must follow this structure:
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
            "line_items": [
                {
                "description": "string",
                "quantity": 0.0,
                "unit_price": 0.0,
                "total": 0.0
                }
            ]
            }

            ### Invoice Text:
            ${text}
            `;

            const payload = {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [{ type: "text", text: prompt }]
                    }
                ]
            }
            const bedrockCommand = new InvokeModelCommand({
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload),
                modelId: "anthropic.claude-3-haiku-20240307-v1:0"
            })

            const bedrockResponse = await bedrockClient.send(bedrockCommand)
            const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body))
            const result = JSON.parse(responseBody.content[0].text)

            await client.models.Invoice.update(
                {
                    id: invoiceId,
                    status: "COMPLETED",
                    vendor: result['Vendor Name'] || result['vendorName'],
                    amount: parseFloat(result['Total Amount'] || result['totalAmount']),
                    date: result['Date'] || result['date'],
                    currency: result['Currency'] || result['currency']
                }
            )
        } catch (error) {
            console.error("Error Processing Invoice")
            if (invoiceId) {
                await client.models.Invoice.update(
                    {
                        id: invoiceId,
                        status: "FAILED",
                    }
                )
            }
            throw error
        }

    }
}