/**
 * Patches ripple-binary-codec@2.6.0-smartescrow.3 definitions
 * to add XLS-66 (Lending Protocol) fields that are missing.
 * Must be called ONCE before any encode() call.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const definitions = require("ripple-binary-codec/dist/enums/definitions.json");

const XLS66_FIELDS: Array<[string, Record<string, unknown>]> = [
  ["ManagementFeeRate", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 22, type: "UInt16" }],
  ["PaymentInterval", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 55, type: "UInt32" }],
  ["GracePeriod", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 56, type: "UInt32" }],
  ["PaymentTotal", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 60, type: "UInt32" }],
  ["LoanSequence", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 61, type: "UInt32" }],
  ["OverpaymentFee", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 64, type: "UInt32" }],
  ["InterestRate", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 65, type: "UInt32" }],
  ["LateInterestRate", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 66, type: "UInt32" }],
  ["CloseInterestRate", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 67, type: "UInt32" }],
  ["OverpaymentInterestRate", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 68, type: "UInt32" }],
  ["LoanBrokerNode", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 31, type: "UInt64" }],
  ["LoanBrokerID", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 37, type: "Hash256" }],
  ["LoanID", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 38, type: "Hash256" }],
  ["Counterparty", { isSerialized: true, isSigningField: true, isVLEncoded: true, nth: 26, type: "AccountID" }],
  ["LoanOriginationFee", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 9, type: "Number" }],
  ["LoanServiceFee", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 10, type: "Number" }],
  ["LatePaymentFee", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 11, type: "Number" }],
  ["ClosePaymentFee", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 12, type: "Number" }],
  ["PrincipalOutstanding", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 13, type: "Number" }],
  ["PrincipalRequested", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 14, type: "Number" }],
  ["ManagementFeeOutstanding", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 17, type: "Number" }],
  ["LoanScale", { isSerialized: true, isSigningField: true, isVLEncoded: false, nth: 1, type: "Int32" }],
  ["CounterpartySignature", { isSerialized: true, isSigningField: false, isVLEncoded: false, nth: 37, type: "STObject" }],
];

const XLS66_TX_TYPES: Record<string, number> = {
  LoanBrokerSet: 74,
  LoanBrokerDelete: 75,
  LoanBrokerCoverDeposit: 76,
  LoanBrokerCoverWithdraw: 77,
  LoanBrokerCoverClawback: 78,
  LoanSet: 80,
  LoanDelete: 81,
  LoanManage: 82,
  LoanPay: 84,
};

const XLS66_LEDGER_TYPES: Record<string, number> = {
  LoanBroker: 136,
  Loan: 137,
};

let patched = false;

export function patchCodecForXLS66(): void {
  if (patched) return;

  const existingFieldNames = new Set(definitions.FIELDS.map((f: [string]) => f[0]));

  for (const field of XLS66_FIELDS) {
    if (!existingFieldNames.has(field[0])) {
      definitions.FIELDS.push(field);
    }
  }

  Object.assign(definitions.TRANSACTION_TYPES, XLS66_TX_TYPES);
  Object.assign(definitions.LEDGER_ENTRY_TYPES, XLS66_LEDGER_TYPES);

  patched = true;
}
