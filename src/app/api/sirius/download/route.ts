import { NextRequest, NextResponse } from "next/server";
import {
  decryptDatasetWithKey,
  getDataset,
  getKeyByLoan,
  isKeyValid,
  applyWatermark,
  generateSeed,
} from "@/lib/sirius";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface DownloadBody {
  datasetId?: string;
  loanId?: string;
  limit?: number;
  applyWatermark?: boolean;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as DownloadBody;

    if (!body.datasetId) return validationError("datasetId");
    if (!body.loanId) return validationError("loanId");

    const dataset = getDataset(body.datasetId);
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const key = getKeyByLoan(body.loanId);
    if (!key) {
      return NextResponse.json(
        { error: "No key issued for this loan" },
        { status: 403 }
      );
    }

    const validation = isKeyValid(key.keyId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Key invalid: ${validation.reason}` },
        { status: 403 }
      );
    }

    if (key.datasetId !== body.datasetId) {
      return NextResponse.json(
        { error: "Key does not match dataset" },
        { status: 403 }
      );
    }

    // Use masterKey for decryption (chunks are encrypted with masterKey)
    // The borrowerKey in key-store is a derived key used for authorization only
    const rows = await decryptDatasetWithKey(
      dataset.manifestCid,
      dataset.masterKeyEncoded
    );

    const limit = Math.max(1, Math.min(1000, body.limit ?? 100));
    const slice = rows.slice(0, limit);

    const seed = generateSeed(key.borrower, body.loanId, dataset.datasetId);
    const { rows: watermarked, report } = applyWatermark(slice, seed);

    return NextResponse.json({
      datasetId: dataset.datasetId,
      loanId: body.loanId,
      rows: watermarked,
      totalRows: rows.length,
      returned: watermarked.length,
      watermark: {
        seed: report.seed.slice(0, 16),
        modifiedRows: report.modifiedRows,
        method: report.method,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
