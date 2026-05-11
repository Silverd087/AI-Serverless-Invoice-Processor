import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { processInvoice } from './functions/process_invoice/resource';
import { invoiceHandler } from './functions/invoice_handler/resource';
import * as iam from "aws-cdk-lib/aws-iam";
import { RestApi, LambdaIntegration, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  storage,
  processInvoice,
  invoiceHandler
});

const storageStack = Stack.of(backend.storage.resources.bucket);

const invoiceRestApi = new RestApi(storageStack, "invoiceApi", {
  restApiName: 'invoiceApi',
  deploy: true,
  deployOptions: {
    stageName: "dev",
  },
  defaultCorsPreflightOptions: {
    allowOrigins: ["*"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["*"]
  }
});

const lambdaIntegration = new LambdaIntegration(backend.invoiceHandler.resources.lambda);
const invoicePath = invoiceRestApi.root.addResource("invoices", {
  defaultMethodOptions: { authorizationType: AuthorizationType.IAM }
});

invoicePath.addMethod("GET", lambdaIntegration);
invoicePath.addMethod("POST", lambdaIntegration);
invoicePath.addResource("{id}").addMethod("GET", lambdaIntegration);

const apiRestPolicy = new iam.Policy(storageStack, "RestApiPolicyV2", {
  statements: [
    new iam.PolicyStatement({
      actions: ["execute-api:Invoke"],
      resources: [
        `${invoiceRestApi.arnForExecuteApi("*", "/invoices", "dev")}`,
        `${invoiceRestApi.arnForExecuteApi("*", "/invoices/*", "dev")}`,
      ],
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(apiRestPolicy);

backend.storage.resources.bucket.grantRead(backend.processInvoice.resources.lambda);
backend.storage.resources.bucket.grantReadWrite(backend.invoiceHandler.resources.lambda);

backend.processInvoice.resources.lambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['textract:AnalyzeDocument', 'bedrock:InvokeModel'],
  resources: ['*']
}));

backend.processInvoice.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["appsync:GraphQL"],
    resources: [`${backend.data.resources.graphqlApi.arn}/*`],
  })
);

backend.invoiceHandler.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["appsync:GraphQL"],
    resources: [`${backend.data.resources.graphqlApi.arn}/*`],
  })
);

backend.invoiceHandler.addEnvironment(
  'INVOICE_BUCKET_NAME',
  backend.storage.resources.bucket.bucketName
);
backend.invoiceHandler.addEnvironment(
  "APPSYNC_ENDPOINT",
  backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl
);

backend.processInvoice.addEnvironment(
  "APPSYNC_ENDPOINT",
  backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl
);
backend.addOutput({
  custom: {
    API: {
      [invoiceRestApi.restApiName]: {
        endpoint: invoiceRestApi.url,
        region: Stack.of(invoiceRestApi).region,
        apiName: invoiceRestApi.restApiName,
      },
    },
  },
});