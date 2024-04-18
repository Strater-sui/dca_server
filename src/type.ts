export type MoveCallTarget = `${string}::${string}::${string}`;

export enum TransactionAction {
  None,
  Place,
  Execute,
  Close,
}

export enum DcaStatus {
  Pending,
  InProgress,
  Failed,
  Completed,
}

export enum OrderStatus {
  Pending,
  Successed,
  Failed,
}

export enum TransactionStatus {
  Pending,
  Successed,
  Failed,
}

export enum ErrorCode {
  SUCCESS = 0,
  FAILED_FETCH = 1,
  NOT_FOUND = 2,
  UNKNOWN_ERROR = 99,

  ERR_INSUFFICIENT_REPAID_AMOUNTERR = 101,
  ERR_INVALID_PRICEERR = 102,
  ERR_NOT_OWNERERR = 103,
  ERR_ALREADY_CLAIMEDERR = 104,
  ERR_MINIMUM_FREQUENCYERR = 105,
  ERR_ZERO_VALUEERR = 106,
  ERR_INVALID_AMOUNTERR = 107,
  ERR_WRONG_ESCROW_IDERR = 108,
  ERR_MAX_PRICEERR = 109,
  ERR_ALL_ORDERS_FILLEDERR = 110,
  ERR_MINIMUM_ORDERSERR = 111,
  ERR_EMPTY_DEPOSITERR = 112,
  ERR_MAX_FEE_RATEERR = 113,
  ERR_INVALID_WINDOWERR = 114,
}


export type EscrowOrderEvent = {
  owner: string;
  escrow: string;
  input_type: string;
  output_type: string;
  min_price: string;
  max_price: string;
  amount: string;
  orders: string;
  frequency: string;

  transaction_hash: string;
  block_number: number;
  timestamp: number;
}

export type SentioEscrowEvent = {
  transaction_hash: string;
  block_number: number;
  timestamp: number;
} & EscrowOrderEvent;

export type ExecuteOrderEvent = {
  owner: string;
  escrow: string;
  withdrawn_y: string;
  balance_x: string;
  balance_y: string;
  spent_x: string;
  executed_order: number;
}

export type SentioExecuteEvent = {
  transaction_hash: string;
  block_number: number;
  timestamp: number;
} & ExecuteOrderEvent;

export type CloseOrderEvent = {
  escrow: string;
  withdrawn_x: string;
  withdrawn_y: string;
}

export type SentioCloseEvent = {
  transaction_hash: string;
  block_number: number;
  timestamp: number;
} & CloseOrderEvent;