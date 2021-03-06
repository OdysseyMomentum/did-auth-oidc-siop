# Validated ID DID SIOP Auth Library

> This is a ValidatedID version of did-auth protocol to authenticate a user and a Relaying Party using vid DIDs.

The current DID Auth implementation follows [DID SIOP Auth](https://identity.foundation/did-siop/), which uses two JSON Web Tokens (JWT) signed by both two parties DID keys in a double challenge-response authentication. It is also supported the protocol to exchange Verifiable Credentials as part of the ID token response.

Current version supports only `ES256k` algorithm (the EC secp256k1).

## Table of Contents

1. [Installation](#Installation)
2. [App 2 App Authentication Flow with VIDcredentials API](#App-2-App-Authentication-Flow-with-VIDcredentials-API)
   1. [Ask ValidatedID for a new API KEY to access VIDcredentials API](Ask-ValidatedId-for-a-new-API-KEY-to-access-VIDcredentials-API)
   2. [Request an Access Token to VIDcredentials API for further calls](#request-an-access-token-to-vidcredentials-api-for-further-calls)
   3. [Prepare Authentication Request Data](#prepare-authentication-request-data)
   4. [Create an Authentication Request URI](#create-an-authentication-request-uri)
   5. [VIDwallet App verifies the received deeplink Url](#vidwallet-app-verifies-the-received-deeplink-url)
   6. [VIDwallet prepares the Authentication Response Structure](#vidwallet-prepares-the-authentication-response-structure)
   7. [VIDwallet creates an Authentication Response URI](#vidwallet-creates-an-authentication-response-uri)
   8. [On Your App, Validate the Authentication Response and retrieve the user DID and requested Verifiable Credentials](#on-your-app-validate-the-authentication-response-and-retrieve-the-user-did-and-requested-verifiable-credentials)
3. [Library Test](#Library-Test)

## Installation

```bash
npm install @validatedid/did-auth
```

or if you use `yarn`

```bash
yarn add @validatedid/did-auth
```

## App 2 App Authentication Flow with VIDcredentials API

![App 2 App Authentication Flow Design](img/siop-vc-exchange.png "Design")

When a new App, called Odyssey App, wants to connect to to the VIDwallet App, and perform an app2app authentication with an exchange of DIDs and request a Verifiable Credential to a user, it can use this flow to make it possible.

Let's explain the steps of this authentication:

### Ask ValidatedID for a new API KEY to access VIDcredentials API

You will need to provide a name to identify your Odyssey App, for instace: `ODYSSEY APP TEST`
Let's use the following example `APIKEY=4ae5f694-98f2-479c-a5be-2c0edb569fb3`

### Request an Access Token to VIDcredentials API for further calls

With your Api Key you can call VIDcredentials API to get an Access Token.

You first need to know the VIDcredentials URL and the `audience` for the token payload:

- `VIDcredentials API URL` = `https://api.vidchain.net`
- `audience` = `vidchain-api`

Here is an example code to to so:

```js
import axios from "axios";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { JWT } from "jose";

function getEnterpriseDID(token: string): string {
  const { payload } = JWT.decode(token, { complete: true });

  return (payload as IEnterpriseAuthZToken).did;
}

const getEntityAuthNToken = async (
  enterpiseName: string,
  apiKey: string,
): Promise<{ jwt: string }> => {
  const payload: LegalEntityAuthNToken = {
    iss: enterpiseName,
    aud: audience,
    iat: moment().unix(),
    exp: moment().add(15, "minutes").unix(),
    nonce: uuidv4(),
    apiKey: apiKey,
  };

  const jwt = Buffer.from(JSON.stringify(payload)).toString("base64");
  return { jwt };
};

const getLegalEntityAuthZToken = async (
  enterpiseName: string,
  apiKey: string
): Promise<{
  jwt: string;
  did: string;
}> => {
  const VIDCREDENTIALS_API_BASE_URL = "https://api.vidchain.net";
  const auth = await getEntityAuthNToken(enterpiseName, apiKey);
  const payload = {
    grantType: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: auth.jwt,
    scope: "vidchain profile entity",
  };

  // Create and sign JWT
  const result = await axios.post(
    `${VIDCREDENTIALS_API_BASE_URL}/api/v1/sessions`,
    payload
  );
  const { accessToken } = result.data as AccessTokenResponseBody;

  return {
    jwt: accessToken,
    did: getEnterpriseDID(accessToken),
  };
};

const odysseyEntity = await getLegalEntityAuthZToken("ODYSSEY APP TEST", "4ae5f694-98f2-479c-a5be-2c0edb569fb3");

const authZToken = odysseyEntity.jwt;
const entityDid = odysseyEntity.did;

```

Now on `authZToken` you have an Access Token to call VIDcredentials API and you also got your DID.

```js
console.log(authZToken);
// eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QiLCJraWQiOiJ2aWRjaGFpbi1hcGkifQ.eyJzdWIiOiJPRFlTU0VZIEFQUCBURVNUIiwiZGlkIjoiZGlkOnZpZDoweDg0QjYwQWRiNzBmNTVjNWNkOGVhMzk3MUFhQzI3MmMzYTBiZEI2NzAiLCJub25jZSI6ImYxYzA3NWVjLWZmMDAtNDY1Zi04ZmI1LTU2MDBjZGU0MjVhNiIsImlhdCI6MTYwNTM1ODkxOCwiZXhwIjoxNjA1MzU5ODE4LCJhdWQiOiJ2aWRjaGFpbi1hcGkifQ.oRl-KFo_0DuAFdVqcVXOaMorlLWnMedzIvXjKMvjK-rJesa4dQ9YoyEwQUnIQOsbwxQ7Sfg3C7AhiqvNhEkQeA
console.log(entityDid);
// did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670
```

### Prepare Authentication Request Data

To initate the flow you need to set the Authentication Request Data.

Let's first explain the different Request elements and then show you an example:

- **oidpUri**: Open Id Provider url address. To connect to VIDwallet: `vidchain://did-auth`
- **redirectUri**: This is your App deeplink to redirect the Authentication Response. Example: `odysseyapp://example/did-auth`
- **requestObjectBy**: Whether you want to generate the Authentication Request embedded in the url or via reference. For this particular flow, it will be embedded in the url.
- **signatureType**: Whether you want to sign the Authentication Request using your own private key or externally. For this particular flow, you will use VIDcredentials API as an external signature type.
- **registrationType**: Whether you want to generate a Registration Object from your keys as a value or as a reference. In this case, it will be as reference using VIDcredentials API.
- **responseMode**: Specifies the way you want to receive the Authentication Response. In this case, it will be `fragment`, which is the default value.
- **responseContext**: Specifies whether the response should be returned to the redirect URI in the intiator context, or whether the response can be returned in a new/empty context. In this case, it will be in the same context (a mobile device). The default `responseContext` is `rp`, indicating that the response should be submitted in the existing initiator context.
- **state**: Opaque value used to maintain state between the request and the callback. Typically, Cross-Site Request Forgery (CSRF, XSRF) mitigation is done by cryptographically binding the value of this parameter with a browser cookie.
- **claims**: OIDC additional claims, in which you can request a specific W3C Verifiable Credential type. As an example, we will request a `VerifiableIdCredential`.

#### Example of a Authentication Request Structure

```json
{
  "oidpUri": "vidchain://did-auth",
  "redirectUri": "odysseyapp://example/did-auth",
  "requestObjectBy": {
    "type": "VALUE"
  },
  "signatureType": {
    "signatureUri": "https://api.vidchain.net/api/v1/signatures",
    "did": "did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670",
    "authZToken": "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QiLCJraWQiOiJ2aWRjaGFpbi1hcGkifQ.eyJzdWIiOiJPRFlTU0VZIEFQUCBURVNUIiwiZGlkIjoiZGlkOnZpZDoweDg0QjYwQWRiNzBmNTVjNWNkOGVhMzk3MUFhQzI3MmMzYTBiZEI2NzAiLCJub25jZSI6IjY1MmFhN2Q0LWVhYTctNDEyZi04YjFlLTZhMzJhOWYzODQxNiIsImlhdCI6MTYwNTM2MDI1OSwiZXhwIjoxNjA1MzYxMTU5LCJhdWQiOiJ2aWRjaGFpbi1hcGkifQ.ooEH46tETgCRxFe_UMlPrnkJja2lyxuoF_MdlPgQKDqkeLjOESd_Qev6hKiV-ksdpH3E99Oq_OMdsgmnw-57WA",
    "kid": "did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670#key-1"
  },
  "registrationType": {
    "type": "REFERENCE",
    "referenceUri": "https://api.vidchain.net/api/v1/identifiers/did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670;transform-keys=jwks"
  },
  "responseMode": "fragment",
  "responseContext": "rp",
  "state": "1f50031ed2e57ed52cf5fc81",
  "claims": {
    "vc": {
      "VerifiableIdCredential": {
        "essential": true
      }
    }
  }
}
```

### Create an Authentication Request URI

With the previous Authentication Request Structure you can initate the flow to create an Authentication Request URI and redirect it to the VIDwallet App.

Example:

Declare the example structure before as `requestOpts`.

```js
import * as siopDidAuth from "@validatedid/did-auth";

const uriRequest = await siopDidAuth.createUriRequest(requestOpts);

console.log(uriRequest);
//     {
//      urlEncoded: 'vidchain%3A%2F%2Fdid-auth%3Fopenid%3A%2F%2F%3Fresponse_type%3Did_token%26client_id%3Dodysseyapp%3A%2F%2Fexample%2Fdid-auth%26scope%3Dopenid%20did_authn%26state%3D5bb6601229e0b922ddc52259%26nonce%3DjRn2K8vDknh6_l40EaprqixvRwRsHpQpTi715aQrWPU%26request%3DeyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHg4NEI2MEFkYjcwZjU1YzVjZDhlYTM5NzFBYUMyNzJjM2EwYmRCNjcwI2tleS0xIn0.eyJpYXQiOjE2MDUzNjIwODksImV4cCI6MTYwNTM2MjM4OSwiaXNzIjoiZGlkOnZpZDoweDg0QjYwQWRiNzBmNTVjNWNkOGVhMzk3MUFhQzI3MmMzYTBiZEI2NzAiLCJzY29wZSI6Im9wZW5pZCBkaWRfYXV0aG4iLCJyZWdpc3RyYXRpb24iOnsiandrc191cmkiOiJodHRwczovL2Rldi52aWRjaGFpbi5uZXQvYXBpL3YxL2lkZW50aWZpZXJzL2RpZDp2aWQ6MHg4NEI2MEFkYjcwZjU1YzVjZDhlYTM5NzFBYUMyNzJjM2EwYmRCNjcwO3RyYW5zZm9ybS1rZXlzPWp3a3MiLCJpZF90b2tlbl9zaWduZWRfcmVzcG9uc2VfYWxnIjoiRVMyNTZLIn0sImNsaWVudF9pZCI6Im9keXNzZXlhcHA6Ly9leGFtcGxlL2RpZC1hdXRoIiwibm9uY2UiOiJqUm4ySzh2RGtuaDZfbDQwRWFwcnFpeHZSd1JzSHBRcFRpNzE1YVFyV1BVIiwic3RhdGUiOiI1YmI2NjAxMjI5ZTBiOTIyZGRjNTIyNTkiLCJyZXNwb25zZV90eXBlIjoiaWRfdG9rZW4iLCJyZXNwb25zZV9tb2RlIjoiZnJhZ21lbnQiLCJyZXNwb25zZV9jb250ZXh0IjoicnAiLCJjbGFpbXMiOnsidmMiOnsiVmVyaWZpYWJsZUlkQ3JlZGVudGlhbCI6eyJlc3NlbnRpYWwiOnRydWV9fX19.AXacqs1vlEIVwidrfdyZMMKrToobD4CYUCbe8VMkjoIkHYu94f3ACk09-jDz1nLs6-1vM5hIl4_e5ZDnm7B1uAA',
//      encoding: 'application/x-www-form-urlencoded'
//    }
```

At that moment, you can perfom a redirect from the `uriRequest.urlEncoded`. Keep in mind that this Url is an UriEncoded.

If you want to read it as a regular Url, you just decode it:

```js
const uriDecoded = decodeURIComponent(uriRequest.urlEncoded);

console.log(uriDecoded);
// vidchain://did-auth?openid://?response_type=id_token&client_id=odysseyapp://example/did-auth&scope=openid did_authn&state=5bb6601229e0b922ddc52259&nonce=jRn2K8vDknh6_l40EaprqixvRwRsHpQpTi715aQrWPU&request=eyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHg4NEI2MEFkYjcwZjU1YzVjZDhlYTM5NzFBYUMyNzJjM2EwYmRCNjcwI2tleS0xIn0.eyJpYXQiOjE2MDUzNjIwODksImV4cCI6MTYwNTM2MjM4OSwiaXNzIjoiZGlkOnZpZDoweDg0QjYwQWRiNzBmNTVjNWNkOGVhMzk3MUFhQzI3MmMzYTBiZEI2NzAiLCJzY29wZSI6Im9wZW5pZCBkaWRfYXV0aG4iLCJyZWdpc3RyYXRpb24iOnsiandrc191cmkiOiJodHRwczovL2Rldi52aWRjaGFpbi5uZXQvYXBpL3YxL2lkZW50aWZpZXJzL2RpZDp2aWQ6MHg4NEI2MEFkYjcwZjU1YzVjZDhlYTM5NzFBYUMyNzJjM2EwYmRCNjcwO3RyYW5zZm9ybS1rZXlzPWp3a3MiLCJpZF90b2tlbl9zaWduZWRfcmVzcG9uc2VfYWxnIjoiRVMyNTZLIn0sImNsaWVudF9pZCI6Im9keXNzZXlhcHA6Ly9leGFtcGxlL2RpZC1hdXRoIiwibm9uY2UiOiJqUm4ySzh2RGtuaDZfbDQwRWFwcnFpeHZSd1JzSHBRcFRpNzE1YVFyV1BVIiwic3RhdGUiOiI1YmI2NjAxMjI5ZTBiOTIyZGRjNTIyNTkiLCJyZXNwb25zZV90eXBlIjoiaWRfdG9rZW4iLCJyZXNwb25zZV9tb2RlIjoiZnJhZ21lbnQiLCJyZXNwb25zZV9jb250ZXh0IjoicnAiLCJjbGFpbXMiOnsidmMiOnsiVmVyaWZpYWJsZUlkQ3JlZGVudGlhbCI6eyJlc3NlbnRpYWwiOnRydWV9fX19.AXacqs1vlEIVwidrfdyZMMKrToobD4CYUCbe8VMkjoIkHYu94f3ACk09-jDz1nLs6-1vM5hIl4_e5ZDnm7B1uAA
```

### VIDwallet App verifies the received deeplink Url

VIDwallet App receives the deeplink, decodes it, and obtains the Authentication Request Token to validated it.

To call `verifyDidAuthRequest` requires a `DidAuthVerifyOpts` structure that contains the following parameters:

- **verificationType**: Whether you want to perform a verification internally or via VIDcredentials API. In this case, we perform it internally.
- **registry**: Smart Contract to resolve the DID.
- **rpcUrl**: Url to the verification method.

> Note: `registry` and `rpcUrl` depends on did method to use.

Example:
Assuming that the `urlEncoded` is the deeplink VIDwallet receives as a redirect.

```js
import { parse } from "querystring";
import * as siopDidAuth from "../../src";

const uriDecoded = decodeURIComponent(urlEncoded);

const data = parse(uriDecoded);
const authRequestToken = data.request as string;

// verify request internally
const optsVerifyRequest: DidAuthVerifyOpts = {
  verificationType: {
    registry: DID_REGISTRY_SC_ADDRESS,
    rpcUrl: DID_PROVIDER_RPC_URL,
  },
};

const validationRequestResponse = await siopDidAuth.verifyDidAuthRequest(
      authRequestToken,
      optsVerifyRequest
    );

console.log(validationRequestResponse);
// {
//      "signatureValidation": true,
//      "payload": {
//        "iat": 1605364884,
//        "exp": 1605365184,
//        "iss": "did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670",
//        "scope": "openid did_authn",
//        "registration": {
//          "jwks_uri": "https://api.vidchain.net/api/v1/identifiers/did:vid:0x84B60Adb70f55c5cd8ea3971AaC272c3a0bdB670;transform-keys=jwks",
//          "id_token_signed_response_alg": "ES256K"
//        },
//        "client_id": "odysseyapp://example/did-auth",
//        "nonce": "H7R5lqrXMf_hf-xCDSQrTnml1kBKLrTThCn4YdzshAc",
//        "state": "15ebd31369ec9d26cd883f56",
//        "response_type": "id_token",
//        "response_mode": "fragment",
//        "response_context": "rp",
//        "claims": {
//          "vc": {
//            "VerifiableIdCredential": {
//              "essential": true
//            }
//          }
//        }
//      }
//    }
```

### VIDwallet prepares the Authentication Response Structure

Similary as before, let's first explain the different Response elements and then show an example:

- **redirectUri**: This is the intiator App deeplink included in the Request to redirect the Authentication Response.
- **signatureType**: Whether you want to sign the Authentication Response using your own private key or externally. For this particular flow, we will use our private key managed by VIDwallet.
- **nonce**: Nonce value included in the Authentication Request Token received.
- **state**: State value included in the Authentication Request Token received.
- **registrationType**: Whether you want to generate a Registration Object from your keys as a value or as a reference. In this case, it will use the `value` option.
- **responseMode**: Specifies the way you want to receive the Authentication Response. In this case, it will be `fragment`, which is the default value.
- **did**: User DID from the private key in VIDwallet used to perform the signature.
- **vp**: A claim response that includes a Verifiable Presentation with the Verifiable Credential type/s requested.

Example:

```json
{
  "redirectUri": "odysseyapp://example/did-auth",
  "signatureType": {
    "hexPrivateKey": "58ab64245715ee6c67f51abe86de3d07cc0a6555b638becae7dab21d6bbe83b2",
    "did": "did:vid:0x8D851667cC475114085F24A145134F2AA8223b00",
    "kid": "did:vid:0x8D851667cC475114085F24A145134F2AA8223b00#key-1"
  },
  "nonce": "agxZnO7jbSDvKhRK2BIgx0he-w3TU035pigj6sRXk7s",
  "state": "ac675fe2981496fad688b3ac",
  "responseMode": "fragment",
  "registrationType": {
    "type": "VALUE"
  },
  "did": "did:vid:0x8D851667cC475114085F24A145134F2AA8223b00",
  "vp": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": "VerifiablePresentation",
    "verifiableCredential": [
      {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://api.vidchain.net/credentials/verifiableId/v1"
        ],
        "id": "https://api.vidchain.net/api/v1/schemas/2391",
        "type": ["VerifiableCredential", "VerifiableIdCredential"],
        "issuer": "did:vid:0x5208431C6EC2ec4097aeA7182bB92d018766498c",
        "credentialSubject": {
          "id": "did:vid:0x8707CCa835C961334D3F6450C6a61a0AD6592460",
          "firstName": "Eva",
          "lastName": "Monroe",
          "gender": "Female",
          "dateOfBirth": "12/11/1970",
          "placeOfBirth": "Madrid",
          "currentAddress": "Arago 179 4a",
          "city": "Barcelona",
          "state": "Cataluña",
          "zip": "08011"
        },
        "issuanceDate": "2019-11-17T14:00:00Z",
        "proof": {
          "type": "EcdsaSecp256k1Signature2019",
          "created": "2019-11-17T14:00:00Z",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:vid:0x5208431C6EC2ec4097aeA7182bB92d018766498c#key-1",
          "jws": "eyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHgzYWQzZkY4RTVhQjhENjkzQzI4QmREOUI0N2VkRDFmNzQ0NUY4YzNGI2tleS0xIn0.eyJpYXQiOjE1OTE3OTk1MDQsInZjIjp7IkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly9hcGkudmlkY2hhaW4ubmV0L2NyZWRlbnRpYWxzL3ZlcmlmaWFibGUtaWQvdjEiXSwiaWQiOiJodHRwczovL2FwaS52aWRjaGFpbi5uZXQvYXBpL3YxL3NjaGVtYXMvMjM5MSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlSWRDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOnZpZDoweDQyYjg5OEUyN0M1NmU3ZDVBMmQ0RTY0NmRCMmQ0MThCRDVDMTcwYzQiLCJmaXJzdE5hbWUiOiJFdmEiLCJsYXN0TmFtZSI6Ik1vbnJvZSIsImdlbmRlciI6IkZlbWFsZSIsImRhdGVPZkJpcnRoIjoiMTIvMTEvMTk3MCIsInBsYWNlT2ZCaXJ0aCI6Ik1hZHJpZCIsImN1cnJlbnRBZGRyZXNzIjoiQXJhZ28gMTc5IDRhIiwiY2l0eSI6IkJhcmNlbG9uYSIsInN0YXRlIjoiQ2F0YWxvbmlhIiwiemlwIjoiMDgwMTEifSwiaXNzdWVyIjoiZGlkOnZpZDoweDNhZDNmRjhFNWFCOEQ2OTNDMjhCZEQ5QjQ3ZWREMWY3NDQ1RjhjM0YifSwiaXNzIjoiZGlkOnZpZDoweDNhZDNmRjhFNWFCOEQ2OTNDMjhCZEQ5QjQ3ZWREMWY3NDQ1RjhjM0YifQ.B7e4Zp9jGLDXTRG8ID1j0_EVwoQlI_XDzSagKWmDR-INjMVSFG1142asC1r5RedNuu3SR8VIcE9yrbDw9cRuEQA"
        }
      }
    ],
    "proof": {
      "type": "EcdsaSecp256k1Signature2019",
      "created": "2019-06-22T14:11:44Z",
      "proofPurpose": "assertionMethod",
      "verificationMethod": "did:vid:0x16048B83FAdaCdCB20198ABc45562Df1A3e289aF#key-1",
      "jws": "eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJFQlNJIDIwMTkifQ.oggE3ft3kJYPGGa9eBibpbjgeJXw4fLbVMouVoM2NfcDxsl_UUUIarsS1VpBoYEs7s9cBlc4uC0EbnJCHfVJIw"
    }
  }
}
```

### VIDwallet creates an Authentication Response URI

With previous Authentication Response Structure data, we can call the library to create an Authentication Response URI encoded, and ready to be redirected to the initiator's App.

Example:

```js
const uriResponse = await siopDidAuth.createUriResponse(responseOpts);

console.log(uriResponse);
//     {
//      urlEncoded: 'odysseyapp%3A%2F%2Fexample%2Fdid-auth%23id_token%3DeyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHgzNDk5YTc3MjA5MmVlMUE2NzBlNjkyOGMxMmE5QkY4NGU0NDU0OWI4I2tleS0xIn0.eyJpYXQiOjE2MDUzNjcwNTQsImV4cCI6MTYwNTM2NzM1NCwiaXNzIjoiaHR0cHM6Ly9zZWxmLWlzc3VlZC5tZSIsInN1YiI6IkdBR0xJRVJJZG84Slg0X3hOOVplZlNkY3dXRmdkQzNIN3MyMEd3Wmh1OUkiLCJub25jZSI6IlNJYUpXQ1NqeFRHMjdJUHhpS2Z1ZUk1WFhYVVNoTzdTWURsek5ES0o2TlUiLCJhdWQiOiJvZHlzc2V5YXBwOi8vZXhhbXBsZS9kaWQtYXV0aCIsInN1Yl9qd2siOnsia2lkIjoiZGlkOnZpZDoweDM0OTlhNzcyMDkyZWUxQTY3MGU2OTI4YzEyYTlCRjg0ZTQ0NTQ5Yjgja2V5LTEiLCJrdHkiOiJFQyIsImNydiI6InNlY3AyNTZrMSIsIngiOiJiOTkzMWZhMTk5ZTcwMTIxNDZhN2QzM2YyNDAyODI3NGUxZDkyODM1NTQ1MWVhMjdiNjhjMjI4NThlYjQzNDY0IiwieSI6IjM3NTFlNDg5YjUxMTJmNjMwZDE2ZmNiYTZkNjU2MjhlZGIzZWFlNmM4ZjFiZTJlOWEzMTMxNWJmN2Q0MmY3NjEifSwiZGlkIjoiZGlkOnZpZDoweDM0OTlhNzcyMDkyZWUxQTY3MGU2OTI4YzEyYTlCRjg0ZTQ0NTQ5YjgiLCJ2cCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjoiVmVyaWZpYWJsZVByZXNlbnRhdGlvbiIsInZlcmlmaWFibGVDcmVkZW50aWFsIjpbeyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vYXBpLnZpZGNoYWluLm5ldC9jcmVkZW50aWFscy92ZXJpZmlhYmxlSWQvdjEiXSwiaWQiOiJodHRwczovL2FwaS52aWRjaGFpbi5uZXQvYXBpL3YxL3NjaGVtYXMvMjM5MSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlSWRDcmVkZW50aWFsIl0sImlzc3VlciI6ImRpZDp2aWQ6MHg1MjA4NDMxQzZFQzJlYzQwOTdhZUE3MTgyYkI5MmQwMTg3NjY0OThjIiwiY3JlZGVudGlhbFN1YmplY3QiOnsiaWQiOiJkaWQ6dmlkOjB4ODcwN0NDYTgzNUM5NjEzMzREM0Y2NDUwQzZhNjFhMEFENjU5MjQ2MCIsImZpcnN0TmFtZSI6IkV2YSIsImxhc3ROYW1lIjoiTW9ucm9lIiwiZ2VuZGVyIjoiRmVtYWxlIiwiZGF0ZU9mQmlydGgiOiIxMi8xMS8xOTcwIiwicGxhY2VPZkJpcnRoIjoiTWFkcmlkIiwiY3VycmVudEFkZHJlc3MiOiJBcmFnbyAxNzkgNGEiLCJjaXR5IjoiQmFyY2Vsb25hIiwic3RhdGUiOiJDYXRhbHXDsWEiLCJ6aXAiOiIwODAxMSJ9LCJpc3N1YW5jZURhdGUiOiIyMDE5LTExLTE3VDE0OjAwOjAwWiIsInByb29mIjp7InR5cGUiOiJFY2RzYVNlY3AyNTZrMVNpZ25hdHVyZTIwMTkiLCJjcmVhdGVkIjoiMjAxOS0xMS0xN1QxNDowMDowMFoiLCJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6dmlkOjB4NTIwODQzMUM2RUMyZWM0MDk3YWVBNzE4MmJCOTJkMDE4NzY2NDk4YyNrZXktMSIsImp3cyI6ImV5SmhiR2NpT2lKRlV6STFOa3N0VWlJc0luUjVjQ0k2SWtwWFZDSXNJbXRwWkNJNkltUnBaRHAyYVdRNk1IZ3pZV1F6WmtZNFJUVmhRamhFTmprelF6STRRbVJFT1VJME4yVmtSREZtTnpRME5VWTRZek5HSTJ0bGVTMHhJbjAuZXlKcFlYUWlPakUxT1RFM09UazFNRFFzSW5aaklqcDdJa0JqYjI1MFpYaDBJanBiSW1oMGRIQnpPaTh2ZDNkM0xuY3pMbTl5Wnk4eU1ERTRMMk55WldSbGJuUnBZV3h6TDNZeElpd2lhSFIwY0hNNkx5OWhjR2t1ZG1sa1kyaGhhVzR1Ym1WMEwyTnlaV1JsYm5ScFlXeHpMM1psY21sbWFXRmliR1V0YVdRdmRqRWlYU3dpYVdRaU9pSm9kSFJ3Y3pvdkwyRndhUzUyYVdSamFHRnBiaTV1WlhRdllYQnBMM1l4TDNOamFHVnRZWE12TWpNNU1TSXNJblI1Y0dVaU9sc2lWbVZ5YVdacFlXSnNaVU55WldSbGJuUnBZV3dpTENKV1pYSnBabWxoWW14bFNXUkRjbVZrWlc1MGFXRnNJbDBzSW1OeVpXUmxiblJwWVd4VGRXSnFaV04wSWpwN0ltbGtJam9pWkdsa09uWnBaRG93ZURReVlqZzVPRVV5TjBNMU5tVTNaRFZCTW1RMFJUWTBObVJDTW1RME1UaENSRFZETVRjd1l6UWlMQ0ptYVhKemRFNWhiV1VpT2lKRmRtRWlMQ0pzWVhOMFRtRnRaU0k2SWsxdmJuSnZaU0lzSW1kbGJtUmxjaUk2SWtabGJXRnNaU0lzSW1SaGRHVlBaa0pwY25Sb0lqb2lNVEl2TVRFdk1UazNNQ0lzSW5Cc1lXTmxUMlpDYVhKMGFDSTZJazFoWkhKcFpDSXNJbU4xY25KbGJuUkJaR1J5WlhOeklqb2lRWEpoWjI4Z01UYzVJRFJoSWl3aVkybDBlU0k2SWtKaGNtTmxiRzl1WVNJc0luTjBZWFJsSWpvaVEyRjBZV3h2Ym1saElpd2llbWx3SWpvaU1EZ3dNVEVpZlN3aWFYTnpkV1Z5SWpvaVpHbGtPblpwWkRvd2VETmhaRE5tUmpoRk5XRkNPRVEyT1RORE1qaENaRVE1UWpRM1pXUkVNV1kzTkRRMVJqaGpNMFlpZlN3aWFYTnpJam9pWkdsa09uWnBaRG93ZUROaFpETm1SamhGTldGQ09FUTJPVE5ETWpoQ1pFUTVRalEzWldSRU1XWTNORFExUmpoak0wWWlmUS5CN2U0WnA5akdMRFhUUkc4SUQxajBfRVZ3b1FsSV9YRHpTYWdLV21EUi1JTmpNVlNGRzExNDJhc0MxcjVSZWROdXUzU1I4VkljRTl5cmJEdzljUnVFUUEifX1dLCJwcm9vZiI6eyJ0eXBlIjoiRWNkc2FTZWNwMjU2azFTaWduYXR1cmUyMDE5IiwiY3JlYXRlZCI6IjIwMTktMDYtMjJUMTQ6MTE6NDRaIiwicHJvb2ZQdXJwb3NlIjoiYXNzZXJ0aW9uTWV0aG9kIiwidmVyaWZpY2F0aW9uTWV0aG9kIjoiZGlkOnZpZDoweDE2MDQ4QjgzRkFkYUNkQ0IyMDE5OEFCYzQ1NTYyRGYxQTNlMjg5YUYja2V5LTEiLCJqd3MiOiJleUpoYkdjaU9pSkZVekkxTmtzaWZRLmV5SnpkV0lpT2lKRlFsTkpJREl3TVRraWZRLm9nZ0UzZnQza0pZUEdHYTllQmlicGJqZ2VKWHc0ZkxiVk1vdVZvTTJOZmNEeHNsX1VVVUlhcnNTMVZwQm9ZRXM3czljQmxjNHVDMEVibkpDSGZWSkl3In19fQ.1fVQmPniGc2Qii-lNxWy1ydPJ2SDWUewXi1MZfXa8sPguNCHZLLAntSj3gB7ExteJBHlBct_JT_eb1jSr6i-PQE%26state%3Dfa78bbbad7f66c3060eb388f',
//      encoding: 'application/x-www-form-urlencoded',
//      response_mode: 'fragment'
//    }
```

The Url to be redirected is included in `uriResponse.urlEncoded`. Keep in mind that this Url is an UriEncoded.

To read it as a regular Url, it can be decoded:

```js
const uriResponseDecoded = decodeURIComponent(uriResponse.urlEncoded);

console.log(uriResponseDecoded);
// odysseyapp://example/did-auth#id_token=eyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHg2Y2Q5NkFhMEQzMmQyRjFlOWM4MzM4MTgxMzQ4MWE4ODBhMzQ0NjY4I2tleS0xIn0.eyJpYXQiOjE2MDUzNjc1MzEsImV4cCI6MTYwNTM2NzgzMSwiaXNzIjoiaHR0cHM6Ly9zZWxmLWlzc3VlZC5tZSIsInN1YiI6IkEyeElIYWVmYWdRTHVyOENfZTE3amZfSktUcl8xVXRaOXNzczJOX0taNTAiLCJub25jZSI6InE1ZmxoVHh6NnZHdE5qREN6ZVRsSFBvNkE4Z3EySEhUTlRqaFpzLW1jUjQiLCJhdWQiOiJvZHlzc2V5YXBwOi8vZXhhbXBsZS9kaWQtYXV0aCIsInN1Yl9qd2siOnsia2lkIjoiZGlkOnZpZDoweDZjZDk2QWEwRDMyZDJGMWU5YzgzMzgxODEzNDgxYTg4MGEzNDQ2Njgja2V5LTEiLCJrdHkiOiJFQyIsImNydiI6InNlY3AyNTZrMSIsIngiOiI3MTE5ZTI5YjZjZDc5NTIzMDRmN2E4NjRkODA4ZjFkNTZmZWY3Y2Y0YTdlYTIyOWFmZTJhMDI0YjlhMDE5OTRkIiwieSI6IjllYzU3NWZkZGVkNjgyNDU4MjU3ZDQ3M2ZhMDg2ZjA2NTdlNzViOWNlNDA4YzFkZWZjZmM1ZjdlOTZlMWVmYWIifSwiZGlkIjoiZGlkOnZpZDoweDZjZDk2QWEwRDMyZDJGMWU5YzgzMzgxODEzNDgxYTg4MGEzNDQ2NjgiLCJ2cCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjoiVmVyaWZpYWJsZVByZXNlbnRhdGlvbiIsInZlcmlmaWFibGVDcmVkZW50aWFsIjpbeyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vYXBpLnZpZGNoYWluLm5ldC9jcmVkZW50aWFscy92ZXJpZmlhYmxlSWQvdjEiXSwiaWQiOiJodHRwczovL2FwaS52aWRjaGFpbi5uZXQvYXBpL3YxL3NjaGVtYXMvMjM5MSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlSWRDcmVkZW50aWFsIl0sImlzc3VlciI6ImRpZDp2aWQ6MHg1MjA4NDMxQzZFQzJlYzQwOTdhZUE3MTgyYkI5MmQwMTg3NjY0OThjIiwiY3JlZGVudGlhbFN1YmplY3QiOnsiaWQiOiJkaWQ6dmlkOjB4ODcwN0NDYTgzNUM5NjEzMzREM0Y2NDUwQzZhNjFhMEFENjU5MjQ2MCIsImZpcnN0TmFtZSI6IkV2YSIsImxhc3ROYW1lIjoiTW9ucm9lIiwiZ2VuZGVyIjoiRmVtYWxlIiwiZGF0ZU9mQmlydGgiOiIxMi8xMS8xOTcwIiwicGxhY2VPZkJpcnRoIjoiTWFkcmlkIiwiY3VycmVudEFkZHJlc3MiOiJBcmFnbyAxNzkgNGEiLCJjaXR5IjoiQmFyY2Vsb25hIiwic3RhdGUiOiJDYXRhbHXDsWEiLCJ6aXAiOiIwODAxMSJ9LCJpc3N1YW5jZURhdGUiOiIyMDE5LTExLTE3VDE0OjAwOjAwWiIsInByb29mIjp7InR5cGUiOiJFY2RzYVNlY3AyNTZrMVNpZ25hdHVyZTIwMTkiLCJjcmVhdGVkIjoiMjAxOS0xMS0xN1QxNDowMDowMFoiLCJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6dmlkOjB4NTIwODQzMUM2RUMyZWM0MDk3YWVBNzE4MmJCOTJkMDE4NzY2NDk4YyNrZXktMSIsImp3cyI6ImV5SmhiR2NpT2lKRlV6STFOa3N0VWlJc0luUjVjQ0k2SWtwWFZDSXNJbXRwWkNJNkltUnBaRHAyYVdRNk1IZ3pZV1F6WmtZNFJUVmhRamhFTmprelF6STRRbVJFT1VJME4yVmtSREZtTnpRME5VWTRZek5HSTJ0bGVTMHhJbjAuZXlKcFlYUWlPakUxT1RFM09UazFNRFFzSW5aaklqcDdJa0JqYjI1MFpYaDBJanBiSW1oMGRIQnpPaTh2ZDNkM0xuY3pMbTl5Wnk4eU1ERTRMMk55WldSbGJuUnBZV3h6TDNZeElpd2lhSFIwY0hNNkx5OWhjR2t1ZG1sa1kyaGhhVzR1Ym1WMEwyTnlaV1JsYm5ScFlXeHpMM1psY21sbWFXRmliR1V0YVdRdmRqRWlYU3dpYVdRaU9pSm9kSFJ3Y3pvdkwyRndhUzUyYVdSamFHRnBiaTV1WlhRdllYQnBMM1l4TDNOamFHVnRZWE12TWpNNU1TSXNJblI1Y0dVaU9sc2lWbVZ5YVdacFlXSnNaVU55WldSbGJuUnBZV3dpTENKV1pYSnBabWxoWW14bFNXUkRjbVZrWlc1MGFXRnNJbDBzSW1OeVpXUmxiblJwWVd4VGRXSnFaV04wSWpwN0ltbGtJam9pWkdsa09uWnBaRG93ZURReVlqZzVPRVV5TjBNMU5tVTNaRFZCTW1RMFJUWTBObVJDTW1RME1UaENSRFZETVRjd1l6UWlMQ0ptYVhKemRFNWhiV1VpT2lKRmRtRWlMQ0pzWVhOMFRtRnRaU0k2SWsxdmJuSnZaU0lzSW1kbGJtUmxjaUk2SWtabGJXRnNaU0lzSW1SaGRHVlBaa0pwY25Sb0lqb2lNVEl2TVRFdk1UazNNQ0lzSW5Cc1lXTmxUMlpDYVhKMGFDSTZJazFoWkhKcFpDSXNJbU4xY25KbGJuUkJaR1J5WlhOeklqb2lRWEpoWjI4Z01UYzVJRFJoSWl3aVkybDBlU0k2SWtKaGNtTmxiRzl1WVNJc0luTjBZWFJsSWpvaVEyRjBZV3h2Ym1saElpd2llbWx3SWpvaU1EZ3dNVEVpZlN3aWFYTnpkV1Z5SWpvaVpHbGtPblpwWkRvd2VETmhaRE5tUmpoRk5XRkNPRVEyT1RORE1qaENaRVE1UWpRM1pXUkVNV1kzTkRRMVJqaGpNMFlpZlN3aWFYTnpJam9pWkdsa09uWnBaRG93ZUROaFpETm1SamhGTldGQ09FUTJPVE5ETWpoQ1pFUTVRalEzWldSRU1XWTNORFExUmpoak0wWWlmUS5CN2U0WnA5akdMRFhUUkc4SUQxajBfRVZ3b1FsSV9YRHpTYWdLV21EUi1JTmpNVlNGRzExNDJhc0MxcjVSZWROdXUzU1I4VkljRTl5cmJEdzljUnVFUUEifX1dLCJwcm9vZiI6eyJ0eXBlIjoiRWNkc2FTZWNwMjU2azFTaWduYXR1cmUyMDE5IiwiY3JlYXRlZCI6IjIwMTktMDYtMjJUMTQ6MTE6NDRaIiwicHJvb2ZQdXJwb3NlIjoiYXNzZXJ0aW9uTWV0aG9kIiwidmVyaWZpY2F0aW9uTWV0aG9kIjoiZGlkOnZpZDoweDE2MDQ4QjgzRkFkYUNkQ0IyMDE5OEFCYzQ1NTYyRGYxQTNlMjg5YUYja2V5LTEiLCJqd3MiOiJleUpoYkdjaU9pSkZVekkxTmtzaWZRLmV5SnpkV0lpT2lKRlFsTkpJREl3TVRraWZRLm9nZ0UzZnQza0pZUEdHYTllQmlicGJqZ2VKWHc0ZkxiVk1vdVZvTTJOZmNEeHNsX1VVVUlhcnNTMVZwQm9ZRXM3czljQmxjNHVDMEVibkpDSGZWSkl3In19fQ.pq3vX7C7_cLfe-LRRHsivNrH50-TxtGORI9SMVQ5bj1jlv_CFf5WNggevjiWLm8jrxkoenqBqXsKF3IGgxlqwwA&state=9caaf9f6d37ed48a9e2247e4
```

### On Your App, Validate the Authentication Response and retrieve the user DID and requested Verifiable Credentials

Last step is that on your App, you parse the received Authentication Response URI, obtain the Response Token and validate it, to finally obtain the desired Verifiable Credentials from the user.

To call `verifyDidAuthResponse` you need to create a `DidAuthVerifyOpts` that contains the following parameters:

- **verificationType**: Whether you want to perform a verification internally or via VIDcredentials API. In this case, we perform it using VIDcredentials API.
- **verifyUri**: URL to perform the external Authenticatoin Response Token validation. In this case, we call the VIDcredentials API.
- **authZToken**: Access Token (if required) to call the verifyUri. In this case, we will use the Access Token created on the first step.
- **nonce**: Nonce value from the initial Authentication Request Token, to check that we are validating the same request flow.

Example:

Assuming that `urlEncoded` is the received deeplink to parse.

```js
const uriResponseDecoded = decodeURIComponent(urlEncoded);
const splitUrl = uriResponseDecoded.split("#");
const responseData = parse(splitUrl[1]);
const authResponseToken = responseData.id_token as string;
const { payload } = JWT.decode(authResponseToken, { complete: true });

const optsVerify: DidAuthVerifyOpts = {
  verificationType: {
    verifyUri: `https://api.vidchain.net/api/v1/signature-validations`,
    authZToken,
  },
  nonce: (payload as DidAuthTypes.DidAuthResponsePayload).nonce,
};
const validationResponse = await verifyDidAuthResponse(
  authResponseToken,
  optsVerify
);
```

`validationResponse` example:

```json
{
  "signatureValidation": true,
  "payload": {
    "iat": 1605368803,
    "exp": 1605369103,
    "iss": "https://self-issued.me",
    "sub": "0QookJTn3cWxZqOL3JwNFeMBNAGyJgDxWEd1MVA16Ek",
    "nonce": "duXGNS_U3A5Sj3S0afYFRMQTy5Z_YskadTj9RLbjLXo",
    "aud": "odysseyapp://example/did-auth",
    "sub_jwk": {
      "kid": "did:vid:0x6B789EF94e1669176e9A414D617e29FbD89f1413#key-1",
      "kty": "EC",
      "crv": "secp256k1",
      "x": "d08288b39daabe0b37d5721da890e76ff846ac46f24e4ad1b94dcaa1ca99d7dc",
      "y": "1d4aa4f4119ef2fb7a3074ec7240c3d4ade41a2c4e57d098e09fff00e2b32790"
    },
    "did": "did:vid:0x6B789EF94e1669176e9A414D617e29FbD89f1413",
    "vp": {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "type": "VerifiablePresentation",
      "verifiableCredential": [
        {
          "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://api.vidchain.net/credentials/verifiableId/v1"
          ],
          "id": "https://api.vidchain.net/api/v1/schemas/2391",
          "type": ["VerifiableCredential", "VerifiableIdCredential"],
          "issuer": "did:vid:0x5208431C6EC2ec4097aeA7182bB92d018766498c",
          "credentialSubject": {
            "id": "did:vid:0x8707CCa835C961334D3F6450C6a61a0AD6592460",
            "firstName": "Eva",
            "lastName": "Monroe",
            "gender": "Female",
            "dateOfBirth": "12/11/1970",
            "placeOfBirth": "Madrid",
            "currentAddress": "Arago 179 4a",
            "city": "Barcelona",
            "state": "Cataluña",
            "zip": "08011"
          },
          "issuanceDate": "2019-11-17T14:00:00Z",
          "proof": {
            "type": "EcdsaSecp256k1Signature2019",
            "created": "2019-11-17T14:00:00Z",
            "proofPurpose": "assertionMethod",
            "verificationMethod": "did:vid:0x5208431C6EC2ec4097aeA7182bB92d018766498c#key-1",
            "jws": "eyJhbGciOiJFUzI1NkstUiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDp2aWQ6MHgzYWQzZkY4RTVhQjhENjkzQzI4QmREOUI0N2VkRDFmNzQ0NUY4YzNGI2tleS0xIn0.eyJpYXQiOjE1OTE3OTk1MDQsInZjIjp7IkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly9hcGkudmlkY2hhaW4ubmV0L2NyZWRlbnRpYWxzL3ZlcmlmaWFibGUtaWQvdjEiXSwiaWQiOiJodHRwczovL2FwaS52aWRjaGFpbi5uZXQvYXBpL3YxL3NjaGVtYXMvMjM5MSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJWZXJpZmlhYmxlSWRDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOnZpZDoweDQyYjg5OEUyN0M1NmU3ZDVBMmQ0RTY0NmRCMmQ0MThCRDVDMTcwYzQiLCJmaXJzdE5hbWUiOiJFdmEiLCJsYXN0TmFtZSI6Ik1vbnJvZSIsImdlbmRlciI6IkZlbWFsZSIsImRhdGVPZkJpcnRoIjoiMTIvMTEvMTk3MCIsInBsYWNlT2ZCaXJ0aCI6Ik1hZHJpZCIsImN1cnJlbnRBZGRyZXNzIjoiQXJhZ28gMTc5IDRhIiwiY2l0eSI6IkJhcmNlbG9uYSIsInN0YXRlIjoiQ2F0YWxvbmlhIiwiemlwIjoiMDgwMTEifSwiaXNzdWVyIjoiZGlkOnZpZDoweDNhZDNmRjhFNWFCOEQ2OTNDMjhCZEQ5QjQ3ZWREMWY3NDQ1RjhjM0YifSwiaXNzIjoiZGlkOnZpZDoweDNhZDNmRjhFNWFCOEQ2OTNDMjhCZEQ5QjQ3ZWREMWY3NDQ1RjhjM0YifQ.B7e4Zp9jGLDXTRG8ID1j0_EVwoQlI_XDzSagKWmDR-INjMVSFG1142asC1r5RedNuu3SR8VIcE9yrbDw9cRuEQA"
          }
        }
      ],
      "proof": {
        "type": "EcdsaSecp256k1Signature2019",
        "created": "2019-06-22T14:11:44Z",
        "proofPurpose": "assertionMethod",
        "verificationMethod": "did:vid:0x16048B83FAdaCdCB20198ABc45562Df1A3e289aF#key-1",
        "jws": "eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJFQlNJIDIwMTkifQ.oggE3ft3kJYPGGa9eBibpbjgeJXw4fLbVMouVoM2NfcDxsl_UUUIarsS1VpBoYEs7s9cBlc4uC0EbnJCHfVJIw"
      }
    }
  }
}
```

In this moment, `"signatureValidation": true` means that you validated the Authentication Response Token and received a Verifiable Presentation that contains the requested Verifiable Credential, under `payload.vp`.

**Et voilà!!**

App 2 App Authentication Flow achieved!! :beers: :joy:

## Library Test

To run `e2e` you need to set these two environment variables either in a `.env` or passing as a parameter to `npm run test:e2e`:

- `DID_REGISTRY_SC_ADDRESS` as the current Smart Contract Address
- `WALLET_API_URL` as the base url for VIDchain API. i.e.: `http://api.vidchain.net`

You can use the `.env.example` from the repo and renamed it to `.env`.

```bash
# run tests
$ npm run test

# unit tests
$ npm run test:unit

# e2e tests
$ npm run test:e2e
```
