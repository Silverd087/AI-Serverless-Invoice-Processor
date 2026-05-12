import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      otpLogin: true
    },
    externalProviders: {
      google: {
        clientId: secret("GOOGLE_CLIENT_ID"),
        clientSecret: secret("GOOGLE_CLIENT_SECRET"),
        scopes: ['profile', 'email', 'openid'],
        attributeMapping: {
          email: 'email',
        }
      },
      callbackUrls: ["http://localhost:5173/", "https://www.invoflow.click/"],
      logoutUrls: ["http://localhost:5173/", "https://www.invoflow.click/"]
    },
  },
  multifactor: {
    mode: "OPTIONAL",
    totp: true
  }
});
