import type { Handler, S3Event } from 'aws-lambda';
import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
import {
    BedrockRuntimeClient,
    InvokeModelCommand,

} from "@aws-sdk/client-bedrock-runtime";
export const handler: Handler = async (event: S3Event) => {
    const config = { region: "us-east-1" }
    const textractClient = new TextractClient(config)
    for (const record of event.Records) {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        try {
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

            const bedrockClient = new BedrockRuntimeClient(config)

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
            const result = JSON.parse(new TextDecoder().decode(bedrockResponse.body))


        } catch (error) {
            console.error("Error Processing Invoice")
            throw error
        }

    }
}