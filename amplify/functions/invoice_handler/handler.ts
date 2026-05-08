import { generateClient } from "aws-amplify/api"
import { APIGatewayProxyHandler } from "aws-lambda"
import type { Schema } from "../../data/resource";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = generateClient<Schema>({
    authMode: "iam"
})

const s3client = new S3Client({});

export const handler: APIGatewayProxyHandler = async (event) => {
    const method = event.httpMethod
    const id = event.pathParameters?.id
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
    }
    try {
        if (event.httpMethod == "GET" && id) {
            const { data: invoice } = await client.models.Invoice.get({ id })
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(invoice)
            }
        }
        if (event.httpMethod == "GET" && !id) {
            const { data: invoices } = await client.models.Invoice.list({});
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(invoices)
            }
        }
        if (event.httpMethod == "POST") {
            const { fileName, filetype } = JSON.parse(event.body || '{}');
            const bucketName = process.env.INVOICE_BUCKET_NAME;
            const s3Key = `uploads/${Date.now()}-${fileName}`;
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                ContentType: filetype || 'application/pdf',
            })
            const url = await getSignedUrl(s3client, command, { expiresIn: 3600 })
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ url, s3Key })
            }
        }
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: "Route not found" })
        };
    }
    catch (error: any) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        }
    }
}
