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
  status: LoanStatus;
  principalAmount: string;
  interestRate: number;
  paymentTotal: number;
  paymentInterval: number;
  gracePeriod: number;
  createdAt: number;
  activatedAt?: number;
  completedAt?: number;
  payments: PaymentRecord[];
}

export interface PaymentRecord {
  txHash: string;
  amount: string;
  timestamp: number;
}

const loans = new Map<string, LoanRecord>();

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

  return loan;
}

export function addPayment(loanId: string, payment: PaymentRecord): LoanRecord {
  const loan = loans.get(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  loan.payments.push(payment);

  if (loan.status === "ACTIVE") {
    transitionLoan(loanId, "REPAYING");
  }

  if (loan.payments.length >= loan.paymentTotal) {
    transitionLoan(loanId, "COMPLETED");
  }

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
