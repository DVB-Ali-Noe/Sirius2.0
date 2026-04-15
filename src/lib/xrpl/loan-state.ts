export type LoanStatus =
  | "PENDING"
  | "ACTIVE"
  | "REPAYING"
  | "COMPLETED"
  | "DEFAULTED"
  | "DISPUTED";

export interface LoanRecord {
  loanId: string;
  borrower: string;
  provider: string;
  loanBroker: string;
  vaultId: string;
  mptIssuanceId: string;
  datasetId?: string;
  status: LoanStatus;
  principalAmount: string;
  interestRate: number;
  paymentTotal: number;
  paymentInterval: number;
  gracePeriod: number;
  pricePerDay?: string;
  durationDays?: number;
  createdAt: number;
  activatedAt?: number;
  expiresAt?: number;
  completedAt?: number;
  distributedAt?: number;
  payments: PaymentRecord[];
}

export interface PaymentRecord {
  txHash: string;
  amount: string;
  timestamp: number;
}

import { loadStore, saveStore } from "@/lib/persistence";

const globalStore = globalThis as unknown as { __sirius_loans?: Map<string, LoanRecord> };
const loans: Map<string, LoanRecord> = globalStore.__sirius_loans ?? loadStore<LoanRecord>("loans");
globalStore.__sirius_loans = loans;

function persist() { saveStore("loans", loans); }

const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  PENDING: ["ACTIVE"],
  ACTIVE: ["REPAYING", "DEFAULTED", "DISPUTED"],
  REPAYING: ["COMPLETED", "DEFAULTED", "DISPUTED"],
  COMPLETED: [],
  DEFAULTED: [],
  DISPUTED: ["ACTIVE", "COMPLETED", "DEFAULTED"],
};

export function createLoanRecord(record: Omit<LoanRecord, "status" | "payments" | "createdAt">): LoanRecord {
  const loan: LoanRecord = {
    ...record,
    status: "PENDING",
    payments: [],
    createdAt: Date.now(),
  };
  loans.set(record.loanId, loan);
  persist();
  return loan;
}

export function transitionLoan(loanId: string, newStatus: LoanStatus): LoanRecord {
  const loan = loans.get(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  const allowed = VALID_TRANSITIONS[loan.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition: ${loan.status} → ${newStatus}`);
  }

  loan.status = newStatus;

  if (newStatus === "ACTIVE") loan.activatedAt = Date.now();
  if (newStatus === "COMPLETED" || newStatus === "DEFAULTED") loan.completedAt = Date.now();

  persist();
  return loan;
}

export function addPayment(loanId: string, payment: PaymentRecord): LoanRecord {
  const loan = loans.get(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  loan.payments.push(payment);

  if (loan.status === "ACTIVE") {
    transitionLoan(loanId, "REPAYING");
  }

  const totalPaidDrops = loan.payments.reduce(
    (sum, p) => sum + Math.round(parseFloat(p.amount) * 1_000_000), 0
  );
  const principal = parseFloat(loan.principalAmount);
  const totalDueDrops = Math.round(principal * (1 + loan.interestRate / 10000) * 1_000_000);

  if (totalPaidDrops >= totalDueDrops && loan.payments.length >= loan.paymentTotal) {
    transitionLoan(loanId, "COMPLETED");
  }

  persist();
  return loan;
}

export function checkDefault(loanId: string): boolean {
  const loan = loans.get(loanId);
  if (!loan || !loan.activatedAt) return false;
  if (loan.status === "COMPLETED" || loan.status === "DEFAULTED") return false;

  const now = Date.now();
  const expectedPayments = Math.floor(
    (now - loan.activatedAt) / (loan.paymentInterval * 1000)
  );
  const graceMs = loan.gracePeriod * 1000;
  const deadlineForNextPayment =
    loan.activatedAt + expectedPayments * loan.paymentInterval * 1000 + graceMs;

  if (loan.payments.length < expectedPayments && now > deadlineForNextPayment) {
    transitionLoan(loanId, "DEFAULTED");
    return true;
  }

  return false;
}

export function getLoan(loanId: string): LoanRecord | undefined {
  return loans.get(loanId);
}

export function getAllLoans(): LoanRecord[] {
  return Array.from(loans.values());
}

export function removeLoan(loanId: string): boolean {
  const r = loans.delete(loanId);
  persist();
  return r;
}

export function clearAllLoans(): number {
  const count = loans.size;
  loans.clear();
  persist();
  return count;
}

export function extendLoanExpiry(loanId: string, additionalMs: number): LoanRecord {
  const loan = loans.get(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.status === "DEFAULTED") {
    throw new Error(`Cannot extend loan in status ${loan.status}`);
  }
  if (loan.status === "COMPLETED") loan.status = "ACTIVE";
  const base = loan.expiresAt && loan.expiresAt > Date.now() ? loan.expiresAt : Date.now();
  loan.expiresAt = base + additionalMs;
  persist();
  return loan;
}
