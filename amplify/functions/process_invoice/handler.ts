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
                You are an invoice processing assistant. Extract the following details from this text:
                - Vendor Name
                - Total Amount (as a number)
                - Date
                - Currency

                Return the result ONLY as a JSON object.
                
                Invoice Text:
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
                    vendorName: result['Vendor Name'] || result['vendorName'],
                    totalAmount: parseFloat(result['Total Amount'] || result['totalAmount']),
                    invoiceDate: result['Date'] || result['date'],
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