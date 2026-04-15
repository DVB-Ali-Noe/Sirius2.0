import { NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl";
import { XRPL_WS_URL } from "@/lib/xrpl/constants";

export const maxDuration = 60;

export async function GET() {
  const start = Date.now();
  try {
    const client = await getClient();
    const connectMs = Date.now() - start;

    const res = await client.request({ command: "server_info" });
    const totalMs = Date.now() - start;

    return NextResponse.json({
      ok: true,
      wsUrl: XRPL_WS_URL,
      connectMs,
      totalMs,
      ledger: (res.result as { info?: { validated_ledger?: { seq?: number } } }).info?.validated_ledger?.seq,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      wsUrl: XRPL_WS_URL,
      ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
