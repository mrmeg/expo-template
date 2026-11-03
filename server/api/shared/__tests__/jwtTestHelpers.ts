/**
 * RS256 signing helpers shared by the Clerk and Cognito token-verifier tests,
 * which each run the real SDK against tokens signed here.
 */

import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";

export type KeyPair = { publicKey: KeyObject; privateKey: KeyObject };

export function rsaKeyPair(): KeyPair {
  return generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signJwt(
  privateKey: KeyObject,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey);
  return `${input}.${base64url(signature)}`;
}

export const now = () => Math.floor(Date.now() / 1000);
