-- Convert monetary columns from DOUBLE PRECISION to DECIMAL(14,2)
-- to prevent floating-point drift in financial calculations.

ALTER TABLE "FreelancerProfile"
  ALTER COLUMN "hourlyRate" TYPE DECIMAL(14,2) USING ROUND("hourlyRate"::numeric, 2),
  ALTER COLUMN "totalEarnings" TYPE DECIMAL(14,2) USING ROUND("totalEarnings"::numeric, 2),
  ALTER COLUMN "balance" TYPE DECIMAL(14,2) USING ROUND("balance"::numeric, 2),
  ALTER COLUMN "pendingWithdrawal" TYPE DECIMAL(14,2) USING ROUND("pendingWithdrawal"::numeric, 2),
  ALTER COLUMN "hourlyRate" SET DEFAULT 500,
  ALTER COLUMN "totalEarnings" SET DEFAULT 0,
  ALTER COLUMN "balance" SET DEFAULT 0,
  ALTER COLUMN "pendingWithdrawal" SET DEFAULT 0;

ALTER TABLE "Order"
  ALTER COLUMN "budget" TYPE DECIMAL(14,2) USING ROUND("budget"::numeric, 2),
  ALTER COLUMN "escrowAmount" TYPE DECIMAL(14,2) USING ROUND("escrowAmount"::numeric, 2),
  ALTER COLUMN "platformFee" TYPE DECIMAL(14,2) USING ROUND("platformFee"::numeric, 2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(14,2) USING ROUND("netAmount"::numeric, 2),
  ALTER COLUMN "escrowAmount" SET DEFAULT 0,
  ALTER COLUMN "platformFee" SET DEFAULT 0,
  ALTER COLUMN "netAmount" SET DEFAULT 0;

ALTER TABLE "Dispute"
  ALTER COLUMN "refundAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "refundAmount" IS NULL THEN NULL
    ELSE ROUND("refundAmount"::numeric, 2)
  END;

ALTER TABLE "Transaction"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "fee" TYPE DECIMAL(14,2) USING ROUND("fee"::numeric, 2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(14,2) USING ROUND("netAmount"::numeric, 2),
  ALTER COLUMN "fee" SET DEFAULT 0;

ALTER TABLE "Withdrawal"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "fee" TYPE DECIMAL(14,2) USING ROUND("fee"::numeric, 2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(14,2) USING ROUND("netAmount"::numeric, 2),
  ALTER COLUMN "fee" SET DEFAULT 0;
