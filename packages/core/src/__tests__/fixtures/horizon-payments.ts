// Realistic testnet Horizon fixtures for the six PaymentRecord union members.
// Addresses are placeholder testnet addresses, not mainnet.

export const TARGET = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
export const SENDER = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
export const RECEIVER = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
export const ISSUER = "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"

export const nativePayment = {
  id: "1001",
  type: "payment",
  transaction_hash: "tx1001",
  created_at: "2026-01-01T00:00:00Z",
  from: SENDER,
  to: TARGET,
  amount: "10.5",
  asset_type: "native",
}

export const createAccount = {
  id: "1002",
  type: "create_account",
  transaction_hash: "tx1002",
  created_at: "2026-01-01T00:00:01Z",
  funder: SENDER,
  account: TARGET,
  starting_balance: "1.5",
}

export const accountMerge = {
  id: "1003",
  type: "account_merge",
  transaction_hash: "tx1003",
  created_at: "2026-01-01T00:00:02Z",
  account: TARGET,
  into: RECEIVER,
}

export const accountMergeEffects = [
  {
    id: "1003-1",
    type: "account_debited",
    account: TARGET,
    amount: "25.5",
    asset_type: "native",
  },
  {
    id: "1003-2",
    type: "account_credited",
    account: RECEIVER,
    amount: "25.5",
    asset_type: "native",
  },
]

export const pathPaymentStrictReceive = {
  id: "1004",
  type: "path_payment_strict_receive",
  transaction_hash: "tx1004",
  created_at: "2026-01-01T00:00:03Z",
  from: SENDER,
  to: TARGET,
  amount: "7.25",
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: ISSUER,
  source_amount: "7.25",
  source_asset_type: "native",
}

export const pathPaymentStrictSend = {
  id: "1005",
  type: "path_payment_strict_send",
  transaction_hash: "tx1005",
  created_at: "2026-01-01T00:00:04Z",
  from: TARGET,
  to: RECEIVER,
  amount: "3.5",
  asset_type: "native",
  source_amount: "3.5",
  source_asset_type: "native",
}

export const invokeHostFunction = {
  id: "1006",
  type: "invoke_host_function",
  transaction_hash: "tx1006",
  created_at: "2026-01-01T00:00:05Z",
  asset_balance_changes: [
    {
      type: "asset_balance_change",
      from: SENDER,
      to: TARGET,
      amount: "12.0",
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: ISSUER,
    },
  ],
}
