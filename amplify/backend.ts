import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { processInvoice } from './functions/process_invoice/resource'
import * as iam from "aws-cdk-lib/aws-iam"

const backend = defineBackend({
  auth,
  data,
  storage,
  processInvoice
});

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