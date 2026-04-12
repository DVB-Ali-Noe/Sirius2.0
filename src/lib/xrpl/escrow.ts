import { Wallet, EscrowCreate, EscrowFinish } from "xrpl";

// Smart Escrow metadata (mocked — EscrowFinishMetadata not in xrpl 4.6.0)
interface EscrowFinishMeta {
  TransactionResult?: string;
  WasmReturnCode?: number;
  GasUsed?: number;
}
import { readFileSync } from "fs";
import { join } from "path";
import { getClient } from "./client";

const ESCROW_WASM_PATH = join(
  process.cwd(),
  "boundless/target/wasm32v1-none/release/escrow.wasm"
);

export async function deploySmartEscrow(
  creator: Wallet,
  destination: string,
  amountDrops: string = "1000000"
): Promise<{ escrowSequence: number }> {
  const client = await getClient();

  const wasmBytes = readFileSync(ESCROW_WASM_PATH);
  const wasmHex = wasmBytes.toString("hex").toUpperCase();

  const tx: EscrowCreate = {
    TransactionType: "EscrowCreate",
    Account: creator.classicAddress,
    Destination: destination,
    Amount: amountDrops,
    FinishFunction: wasmHex,
  };

  const result = await client.submitAndWait(tx, { wallet: creator });

  const meta = result.result.meta as { TransactionResult?: string } | undefined;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`EscrowCreate failed: ${meta?.TransactionResult ?? "unknown"}`);
  }

  const sequence = result.result.tx_json?.Sequence;
  if (sequence === undefined) {
    throw new Error("EscrowCreate: no sequence in result");
  }

  return { escrowSequence: sequence as number };
}

export async function finishSmartEscrow(
  finisher: Wallet,
  escrowOwner: string,
  escrowSequence: number,
  journalHex: string,
  sealHex: string
): Promise<{ txHash: string; wasmReturnCode: number }> {
  const client = await getClient();

  const tx: EscrowFinish = {
    TransactionType: "EscrowFinish",
    Account: finisher.classicAddress,
    Owner: escrowOwner,
    OfferSequence: escrowSequence,
    ComputationAllowance: 100000,
    Memos: [
      {
        Memo: {
          MemoData: journalHex.toUpperCase(),
          MemoType: Buffer.from("journal").toString("hex").toUpperCase(),
        },
      },
      {
        Memo: {
          MemoData: sealHex.toUpperCase(),
          MemoType: Buffer.from("seal").toString("hex").toUpperCase(),
        },
      },
    ],
  };

  const result = await client.submitAndWait(tx, { wallet: finisher });

  const meta = result.result.meta as EscrowFinishMeta | undefined;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`EscrowFinish failed: ${meta?.TransactionResult ?? "unknown"}`);
  }

  const wasmReturnCode = meta?.WasmReturnCode ?? -1;
  const txHash = result.result.hash;

  return { txHash, wasmReturnCode };
}
