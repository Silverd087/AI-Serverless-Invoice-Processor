import React from "react";
import ReactDOM from "react-dom/client";import App from "./App.tsx";
import "./index.css";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

const existingConfig = Amplify.getConfig();
Amplify.configure({
  ...existingConfig,
  API: {
    ...existingConfig.API,
    REST: {
      ...existingConfig.API?.REST,
      invoiceApi: {
        endpoint: (outputs as any).custom.API.invoiceApi.endpoint,
        region: (outputs as any).custom.API.invoiceApi.region
      }
    }
  }
});


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator>
      <App />
    </Authenticator>
  </React.StrictMode>
);
