import { AuthUser, fetchAuthSession } from "aws-amplify/auth";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";


const API_ENDPOINT = "https://ut32kxo1wk.execute-api.us-east-1.amazonaws.com/dev";
const REGION = "us-east-1";
interface UploadRequestBody {
    filetype: string;
    filename: string;
}
export async function signedGet(path: string): Promise<Response> {
    const { credentials } = await fetchAuthSession();
    const url = new URL(`${API_ENDPOINT}${path}`);

    const signer = new SignatureV4({
        credentials: credentials!,
        region: REGION,
        service: "execute-api",
        sha256: Sha256,
    });

    const signed = await signer.sign({
        method: "GET",
        hostname: url.hostname,
        path: url.pathname,
        protocol: "https",
        headers: { host: url.hostname },
    });

    return fetch(url.toString(), {
        method: "GET",
        headers: signed.headers as Record<string, string>,
    });
}

export async function signedPost(path: string, body: UploadRequestBody, user: AuthUser): Promise<Response> {
    const { credentials } = await fetchAuthSession();
    const url = new URL(`${API_ENDPOINT}${path}`);
    const bodyStr = JSON.stringify(body);

    const signer = new SignatureV4({
        credentials: credentials!,
        region: REGION,
        service: "execute-api",
        sha256: Sha256,
    });

    const signed = await signer.sign({
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        protocol: "https",
        headers: {
            host: url.hostname,
            "content-type": 'a',
            "x-amz-meta-owner": user.userId
        },
        body: bodyStr,
    });

    return fetch(url.toString(), {
        method: "POST",
        headers: signed.headers as Record<string, string>,
        body: bodyStr,
    });
}