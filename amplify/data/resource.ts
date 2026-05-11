import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  LineItem: a.customType({
    description: a.string(),
    quantity: a.float(),
    unit_price: a.float(),
    total: a.float(),
  }),

  Invoice: a
    .model({
      id: a.string().required(),
      s3Key: a.string(),
      owner: a.string(),
      status: a.enum(["PROCESSING", "COMPLETED", "FAILED", "REVIEW"]),
      vendor: a.string(),
      amount: a.float(),
      date: a.datetime(),
      due_date: a.datetime(),
      currency: a.enum(["USD", "CAD"]),

      invoice_number: a.string(),
      po_number: a.string(),
      tax_amount: a.float(),
      subtotal: a.float(),
      payment_terms: a.string(),
      notes: a.string(),
      confidence: a.float(),
      filename: a.string(),

      uploaded_at: a.datetime(),
      processed_at: a.datetime(),

      vendor_address: a.string(),
      vendor_email: a.string(),
      vendor_phone: a.string(),

      line_items: a.ref("LineItem").array(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(["read"])
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
