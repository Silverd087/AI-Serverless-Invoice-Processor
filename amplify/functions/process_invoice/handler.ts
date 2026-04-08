import type { Handler, S3Event } from 'aws-lambda';
import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";
export const handler: Handler = async (event: S3Event) => {
    const config = { region: "us-east-1" }
    const client = new TextractClient(config)
    for (const record of event.Records) {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        try {
            const command = new AnalyzeDocumentCommand({
                Document: {
                    S3Object: {
                        Bucket: bucketName,
                        Name: objectKey
                    }
                },
                FeatureTypes: ["TABLES", "FORMS", "QUERIES"]
            })
            const response = await client.send(command)
        } catch (error) {
            console.error("Error Processing Invoice")
            throw error
        }

    }
}