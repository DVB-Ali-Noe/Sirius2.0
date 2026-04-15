import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl";
import { apiError, validationError } from "@/lib/api-utils";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type");
    const id = request.nextUrl.searchParams.get("id");

    if (!type || !id) return validationError("type and id required");

    const client = await getClient();

    if (type === "mpt") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (client as any).request({
        command: "ledger_entry",
        mpt_issuance: id,
      });
      const node = (res.result as { node: Record<string, unknown> }).node;
      const metaHex = node.MPTokenMetadata as string;
      let metaJson = null;
      if (metaHex) {
        try { metaJson = JSON.parse(Buffer.from(metaHex, "hex").toString("utf-8")); } catch {}
      }
      return NextResponse.json({ type: "mpt", id, node, metadataDecoded: metaJson });
    }

    if (type === "account") {
      const res = await client.request({ command: "account_info", account: id });
      return NextResponse.json({ type: "account", id, ...(res.result as Record<string, unknown>) });
    }

    if (type === "tx") {
      const res = await (client as never as { request: (r: unknown) => Promise<{ result: unknown }> }).request({
        command: "tx",
        transaction: id,
      });
      return NextResponse.json({ type: "tx", id, ...res.result as Record<string, unknown> });
    }

    if (type === "escrow") {
      const owner = request.nextUrl.searchParams.get("owner");
      const seq = request.nextUrl.searchParams.get("seq");
      if (!owner || !seq) return validationError("owner and seq required for escrow");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (client as any).request({
        command: "ledger_entry",
        escrow: { owner, seq: parseInt(seq) },
      });
      return NextResponse.json({ type: "escrow", ...(res.result as Record<string, unknown>) });
    }

    return validationError("type must be mpt, account, tx, or escrow");
  } catch (error) {
    return apiError(error);
  }
}
