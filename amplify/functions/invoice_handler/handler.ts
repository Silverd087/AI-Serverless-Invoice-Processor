import { APIGatewayProxyHandler } from "aws-lambda";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3client = new S3Client({});
const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT!;
const REGION = process.env.AWS_REGION!;

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
        headers: {
            host: url.hostname,
            "content-type": "application/json",
        },
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

export const handler: APIGatewayProxyHandler = async (event) => {
    console.log("EVENT:", JSON.stringify(event));
    console.log("APPSYNC_ENDPOINT:", APPSYNC_ENDPOINT);

    const id = event.pathParameters?.id;
    console.log(event.requestContext)
    const identity = event.requestContext.identity;
    const authProvider = identity.cognitoAuthenticationProvider || "";
    const owner = authProvider.split(':').pop();
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
    };

    try {
        if (event.httpMethod === "GET" && id) {
            const query = `
        query GetInvoice($id: String!) {
            getInvoice(id: $id) {
                id
                owner
                s3Key
                status
                vendor
                amount
                date
                due_date
                currency
                invoice_number
                po_number
                tax_amount
                subtotal
                payment_terms
                notes
                confidence
                filename
                uploaded_at
                processed_at
                vendor_address
                vendor_email
                vendor_phone
            }
        }
    `;

            try {
                const data = await appsyncRequest(query, { id });

                if (!data || !data.getInvoice) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: "Invoice not found in database." })
                    };
                }

                let invoice = data.getInvoice

                if (invoice.owner != owner) {
                    console.error(`Unauthorized access attempt by User: ${owner} on Invoice: ${id}`);
                    return {
                        statusCode: 403,
                        headers,
                        body: JSON.stringify({ error: "Forbidden: You do not have permission to view this invoice." })
                    };
                }
                if (invoice.s3Key) {
                    const getCommand = new GetObjectCommand({
                        Bucket: process.env.INVOICE_BUCKET_NAME,
                        Key: invoice.s3Key,
                    });

                    invoice.pdfUrl = await getSignedUrl(s3client, getCommand, { expiresIn: 3600 });
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(invoice)
                };
            } catch (error: any) {
                console.error("AppSync Query Failed:", error.message);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: "Failed to fetch invoice from database." })
                };
            }
        }

        if (event.httpMethod === "GET" && !id) {
            const data = await appsyncRequest(`
    query ListInvoices($owner:String!) {
      listInvoices(filter:{owner:{eq:$owner}}) {
        items {
          id
          s3Key
          status
          vendor
          amount
          date
          due_date
          currency
          invoice_number
          po_number
          tax_amount
          subtotal
          payment_terms
          notes
          confidence
          filename
          uploaded_at
          processed_at
          vendor_address
          vendor_email
          vendor_phone
        }
      }
    }
  `, { owner: owner });
            return { statusCode: 200, headers, body: JSON.stringify(data.listInvoices.items) };
        }

        if (event.httpMethod === "POST") {
            const { filename, filetype } = JSON.parse(event.body || "{}");
            const ownerId = event.headers['x-amz-meta-owner'];
            const bucketName = process.env.INVOICE_BUCKET_NAME;
            const s3Key = `uploads/${ownerId}/${Date.now()}-${filename}`;
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                ContentType: filetype || "application/pdf",
            });
            const url = await getSignedUrl(s3client, command, { expiresIn: 3600 });
            return { statusCode: 200, headers, body: JSON.stringify({ url, s3Key }) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ message: "Route not found" }) };

    } catch (error: any) {
        console.error("Handler error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};