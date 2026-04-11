import { Wallet, CredentialCreate, CredentialAccept } from "xrpl";
import { getClient } from "./client";

const CREDENTIAL_TYPES = {
  DataProviderCertified: "DataProviderCertified",
  BorrowerKYB: "BorrowerKYB",
  TierOneCertified: "TierOneCertified",
  DefaultBlacklist: "DefaultBlacklist",
} as const;

type CredentialTypeName = keyof typeof CREDENTIAL_TYPES;

function toHex(str: string): string {
  return Buffer.from(str).toString("hex").toUpperCase();
}

export async function issueCredential(
  issuer: Wallet,
  subject: string,
  credentialType: CredentialTypeName,
  uri?: string
): Promise<void> {
  const client = await getClient();

  const tx: CredentialCreate = {
    TransactionType: "CredentialCreate",
    Account: issuer.classicAddress,
    Subject: subject,
    CredentialType: toHex(CREDENTIAL_TYPES[credentialType]),
    ...(uri && { URI: toHex(uri) }),
  };

  await client.submitAndWait(tx, { wallet: issuer });
}

export async function acceptCredential(
  subject: Wallet,
  issuerAddress: string,
  credentialType: CredentialTypeName
): Promise<void> {
  const client = await getClient();

  const tx: CredentialAccept = {
    TransactionType: "CredentialAccept",
    Account: subject.classicAddress,
    Issuer: issuerAddress,
    CredentialType: toHex(CREDENTIAL_TYPES[credentialType]),
  };

  await client.submitAndWait(tx, { wallet: subject });
}

export { CREDENTIAL_TYPES, type CredentialTypeName };
