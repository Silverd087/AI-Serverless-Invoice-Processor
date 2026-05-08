import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { processInvoice } from './functions/process_invoice/resource'
import * as iam from "aws-cdk-lib/aws-iam"
import { invoiceHandler } from './functions/invoice_handler/resource';
import { RestApi, LambdaIntegration, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';

const backend = defineBackend({
  auth,
  data,
  storage,
  processInvoice,
  invoiceHandler
});

const apistack = backend.createStack("api-stack")

const inoviceRestApi = new RestApi(apistack, "RestApi", {
  restApiName: 'invoiceRestApi',
  deploy: true,
  deployOptions: {
    stageName: "dev"
  },
  defaultCorsPreflightOptions: {
    allowOrigins: ["*"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["*"]
  }
})

const lambdaIntegration = new LambdaIntegration(
  backend.invoiceHandler.resources.lambda
);

const invoicePath = inoviceRestApi.root.addResource("invoices", {
  defaultMethodOptions: {
    authorizationType: AuthorizationType.IAM,
  },
});

invoicePath.addMethod("GET", lambdaIntegration)
invoicePath.addMethod("POST", lambdaIntegration)

const signleInvoicePath = invoicePath.addResource("{id}")
signleInvoicePath.addMethod("GET", lambdaIntegration)

const textractStatement = new iam.PolicyStatement({
  sid: "AllowLambdaToAnalyzeDocument",
  actions: ['textract:AnalyzeDocument'],
  resources: ['*']
})

const bedrockStatement = new iam.PolicyStatement({
  sid: "AllowLambdaToInvokeModel",
  actions: ['bedrock:InvokeModel'],
  resources: ['*']
})


backend.processInvoice.resources.lambda.addToRolePolicy(textractStatement)
backend.processInvoice.resources.lambda.addToRolePolicy(bedrockStatement)

backend.invoiceHandler.addEnvironment(
  'INVOICE_BUCKET_NAME',
  backend.storage.resources.bucket.bucketName
);

backend.addOutput({
  custom: {
    apiEndpoint: inoviceRestApi.url,
  }
});