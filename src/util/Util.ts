import SHA from "sha.js";
import axios, { AxiosResponse } from "axios";
import { ethers, utils } from "ethers";
import { decodeJWT } from "did-jwt";
import { JWK, DidAuthErrors } from "../interfaces";

export const prefixWith0x = (key: string): string => {
  return key.startsWith("0x") ? key : `0x${key}`;
};

const fromBase64 = (base64: string) => {
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const base64urlEncodeBuffer = (buf: {
  toString: (arg0: "base64") => string;
}): string => {
  return fromBase64(buf.toString("base64"));
};

function getNonce(input: string): string {
  const buff = SHA("sha256").update(input).digest();
  return base64urlEncodeBuffer(buff);
}

function getState(): string {
  const randomNumber = ethers.BigNumber.from(utils.randomBytes(12));
  return utils.hexlify(randomNumber).replace("0x", "");
}

function toHex(data: string): string {
  return Buffer.from(data, "base64").toString("hex");
}

function getEthWallet(key: JWK.Key): ethers.Wallet {
  return new ethers.Wallet(prefixWith0x(toHex(key.d)));
}

function getHexPrivateKey(key: JWK.Key): string {
  return getEthWallet(key).privateKey;
}

function getEthAddress(key: JWK.ECKey): string {
  return getEthWallet(key).address;
}

function getDIDFromKey(key: JWK.ECKey): string {
  return `did:vid:${getEthAddress(key)}`;
}

async function doPostCallWithToken(
  url: string,
  data: unknown,
  token: string
): Promise<AxiosResponse> {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  const response = await axios.post(url, data, config);
  return response;
}

const getAudience = (jwt: string): string | undefined => {
  const { payload } = decodeJWT(jwt);
  if (!payload) throw new Error(DidAuthErrors.NO_AUDIENCE);
  if (!payload.aud) return undefined;
  if (Array.isArray(payload.aud))
    throw new Error(DidAuthErrors.INVALID_AUDIENCE);
  return payload.aud;
};

export {
  getNonce,
  getState,
  getAudience,
  getDIDFromKey,
  getHexPrivateKey,
  doPostCallWithToken,
  base64urlEncodeBuffer,
};
