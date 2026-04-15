import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl";
import { apiError, validationError } from "@/lib/api-utils";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return validationError("address");

    const client = await getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client as any).request({
      command: "account_objects",
      account: address,
      type: "credential",
      ledger_index: "validated",
    });

    const objects = (res.result as { account_objects?: Array<Record<string, unknown>> }).account_objects ?? [];

    const credentials = objects.map((obj) => {
      let credentialType = (obj.CredentialType as string) ?? "";
      try {
        const bytes = new Uint8Array(
          (credentialType.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
        );
        credentialType = new TextDecoder().decode(bytes);
      } catch {}
      return {
        credentialType,
        issuer: obj.Issuer as string,
        subject: obj.Subject as string,
        accepted: ((obj.Flags as number) ?? 0) !== 0,
      };
    });

    return NextResponse.json({ credentials });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Account not found") || msg.includes("actNotFound")) {
      return NextResponse.json({ credentials: [] });
    }
    return apiError(error);
  }
}
