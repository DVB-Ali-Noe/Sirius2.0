import { Wallet, Client, encode } from "xrpl";
import { sign as rawSign } from "ripple-keypairs";
import { XRPL_NETWORK_ID } from "./constants";

const HASH_PREFIX_TX_SIGN = "53545800";
const TX_POLL_INTERVAL = 1000;
const TX_POLL_MAX_ATTEMPTS = 25;

interface RawTxResult {
  hash: string;
  engineResult: string;
  validated: boolean;
  meta?: Record<string, unknown>;
}

export async function submitRawTx(
  client: Client,
  wallet: Wallet,
  tx: Record<string, unknown>
): Promise<RawTxResult> {
  const acctInfo = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
  });
  const ledgerInfo = await client.request({
    command: "ledger_current",
  });

  const lastLedgerSeq = (ledgerInfo.result as { ledger_current_index: number }).ledger_current_index + 20;

  const prepared = {
    ...tx,
    Account: wallet.classicAddress,
    Fee: "5000",
    Sequence: (acctInfo.result as { account_data: { Sequence: number } }).account_data.Sequence,
    LastLedgerSequence: lastLedgerSeq,
    NetworkID: XRPL_NETWORK_ID,
    SigningPubKey: wallet.publicKey,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encoded = encode(prepared as any);
  const signature = rawSign(HASH_PREFIX_TX_SIGN + encoded, wallet.privateKey);
  (prepared as Record<string, unknown>).TxnSignature = signature;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txBlob = encode(prepared as any);

  const result = await client.request({
    command: "submit",
    tx_blob: txBlob,
  });

  const engineResult = (result.result as { engine_result: string }).engine_result;
  const hash = (result.result as { tx_json?: { hash?: string } }).tx_json?.hash ?? "";

  if (engineResult !== "tesSUCCESS" && engineResult !== "terQUEUED") {
    throw new Error(`Transaction rejected: ${engineResult}`);
  }

  // Poll for validated result
  for (let i = 0; i < TX_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, TX_POLL_INTERVAL));

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txResult = await (client as any).request({
        command: "tx",
        transaction: hash,
      });

      const txRes = txResult.result as {
        validated?: boolean;
        meta?: { TransactionResult?: string };
      };

      if (txRes.validated) {
        const finalResult = txRes.meta?.TransactionResult ?? engineResult;
        if (finalResult !== "tesSUCCESS") {
          throw new Error(`Transaction failed on-chain: ${finalResult}`);
        }
        return { hash, engineResult: finalResult, validated: true, meta: txRes.meta as Record<string, unknown> };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("txnNotFound")) continue;
      throw e;
    }

    // Check if LastLedgerSequence has passed
    const currentLedger = await client.request({ command: "ledger_current" });
    const currentIndex = (currentLedger.result as { ledger_current_index: number }).ledger_current_index;
    if (currentIndex > lastLedgerSeq) {
      throw new Error(`Transaction expired: LastLedgerSequence ${lastLedgerSeq} passed (current: ${currentIndex})`);
    }
  }

  throw new Error(`Transaction not validated after ${TX_POLL_MAX_ATTEMPTS} attempts`);
}
