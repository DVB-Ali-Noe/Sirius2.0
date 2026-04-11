import { Wallet, PermissionedDomainSet } from "xrpl";
import { getClient } from "./client";

interface CredentialRequirement {
  issuer: string;
  credentialType: string;
}

function toHex(str: string): string {
  return Buffer.from(str).toString("hex").toUpperCase();
}

export async function createPermissionedDomain(
  owner: Wallet,
  credentials: CredentialRequirement[]
): Promise<string> {
  const client = await getClient();

  const tx: PermissionedDomainSet = {
    TransactionType: "PermissionedDomainSet",
    Account: owner.classicAddress,
    AcceptedCredentials: credentials.map((cred) => ({
      Credential: {
        Issuer: cred.issuer,
        CredentialType: toHex(cred.credentialType),
      },
    })),
  };

  const result = await client.submitAndWait(tx, { wallet: owner });

  const createdNode = (
    result.result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> }
  )?.AffectedNodes?.find(
    (n) => n.CreatedNode?.LedgerEntryType === "PermissionedDomain"
  );

  const domainId = createdNode?.CreatedNode?.LedgerIndex;
  if (!domainId) {
    throw new Error("PermissionedDomain creation failed: no domain ID");
  }

  return domainId;
}

export async function updatePermissionedDomain(
  owner: Wallet,
  domainId: string,
  credentials: CredentialRequirement[]
): Promise<void> {
  const client = await getClient();

  const tx: PermissionedDomainSet = {
    TransactionType: "PermissionedDomainSet",
    Account: owner.classicAddress,
    DomainID: domainId,
    AcceptedCredentials: credentials.map((cred) => ({
      Credential: {
        Issuer: cred.issuer,
        CredentialType: toHex(cred.credentialType),
      },
    })),
  };

  await client.submitAndWait(tx, { wallet: owner });
}
