import {
  TransactionArgument,
  Transaction,
  TransactionObjectArgument,
  TransactionResult,
} from "@mysten/sui/transactions";
import {
  ORACLE_OBJECT,
  CLOCK_OBJECT,
  COIN,
  COINS_TYPE_LIST,
  SUPRA_PRICE_FEEDS,
} from "bucket-protocol-sdk";
import { COIN_METADATA, DCA_BUCKET_CONFIG, DCA_CONFIG } from "../config";
import { SuiClient } from "@mysten/sui/client";
import { DCA_CAP } from "../constants";

export function dcaPlaceOrder(
  tx: Transaction,
  inputs: {
    owner: string;
    inputCoin: TransactionObjectArgument;
    inputToken: COIN;
    outputToken: COIN;
    frequency: number;
    orders: number;
    priceEnabled: boolean;
    minPrice: string;
    maxPrice: string;
  },
): [TransactionObjectArgument] {
  const {
    owner,
    inputCoin,
    inputToken,
    outputToken,
    frequency,
    orders,
    priceEnabled,
    minPrice,
    maxPrice,
  } = inputs;
  const [escrow] = tx.moveCall({
    target: DCA_CONFIG.targets.placeOrder,
    typeArguments: [COINS_TYPE_LIST[inputToken], COINS_TYPE_LIST[outputToken]],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.pure.address(owner),
      inputCoin,
      tx.object(COIN_METADATA[inputToken]),
      tx.object(COIN_METADATA[outputToken]),
      tx.pure.u64(frequency),
      tx.pure.u64(orders),
      tx.pure.bool(priceEnabled),
      tx.pure.u128(minPrice),
      tx.pure.u128(maxPrice),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });
  return [escrow];
}

export function dcaExecuteOrder(
  tx: Transaction,
  inputs: {
    inputType: string;
    outputType: string;
    escrowId: string;
  },
): [TransactionObjectArgument, TransactionArgument] {
  const { inputType, outputType, escrowId } = inputs;

  const [coinX, receipt] = tx.moveCall({
    target: DCA_CONFIG.targets.executeOrder,
    typeArguments: [inputType, outputType],
    arguments: [
      tx.object(escrowId),
      tx.object(DCA_CAP),
      tx.sharedObjectRef(ORACLE_OBJECT),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });

  return [coinX, receipt];
}
export function dcaRepayOrder(
  tx: Transaction,
  inputs: {
    inputType: string;
    outputType: string;
    escrowId: string;
    receipt: TransactionArgument;
    coinOut: TransactionObjectArgument;
  },
) {
  const { inputType, outputType, escrowId, receipt, coinOut } = inputs;
  tx.moveCall({
    target: DCA_CONFIG.targets.repayOrder,
    typeArguments: [inputType, outputType],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.object(DCA_CAP),
      tx.object(escrowId),
      receipt,
      coinOut,
    ],
  });
}

export function dcaClearEscrow(
  tx: Transaction,
  inputs: {
    inputType: string;
    outputType: string;
    escrowId: string;
  },
) {
  const { inputType, outputType, escrowId } = inputs;
  tx.moveCall({
    target: DCA_CONFIG.targets.clearEscrow,
    typeArguments: [inputType, outputType],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.object(DCA_CAP),
      tx.object(escrowId),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });
}

export function dcaCloseEscrow(
  tx: Transaction,
  inputs: {
    inputType: string;
    outputType: string;
    escrowId: string;
  },
): [TransactionObjectArgument, TransactionObjectArgument] {
  const { inputType, outputType, escrowId } = inputs;
  const [coinX, coinY] = tx.moveCall({
    target: DCA_CONFIG.targets.closeEscrow,
    typeArguments: [inputType, outputType],
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG), tx.object(escrowId)],
  });
  return [coinX, coinY];
}

export function dcaClaimFee(
  tx: Transaction,
  coinSymbol: COIN,
  cap: string,
  amount: number | TransactionArgument,
) {
  tx.moveCall({
    target: DCA_CONFIG.targets.claimFee,
    typeArguments: [COINS_TYPE_LIST[coinSymbol]],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.object(cap),
      typeof amount === "number" ? tx.pure.u64(amount) : amount,
    ],
  });
}

//Getter
export function totalEscrows(tx: Transaction) {
  tx.moveCall({
    target: DCA_CONFIG.targets.totalEscrows,
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG)],
  });
}
export function feeBalance(tx: Transaction, coin: COIN) {
  tx.moveCall({
    target: DCA_CONFIG.targets.feeBalance,
    typeArguments: [COINS_TYPE_LIST[coin]],
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG)],
  });
}

//Utils
export async function getInputCoins(
  tx: Transaction,
  suiClient: SuiClient,
  owner: string,
  coinSymbol: COIN,
  ...amounts: number[]
): Promise<TransactionResult> {
  const coinType = COINS_TYPE_LIST[coinSymbol];
  if (coinType === COINS_TYPE_LIST.SUI) {
    return tx.splitCoins(
      tx.gas,
      amounts.map((amount) => tx.pure.u64(amount)),
    );
  }

  const { data: userCoins } = await suiClient.getCoins({ owner, coinType });
  const [mainCoin, ...otherCoins] = userCoins.map((coin) =>
    tx.objectRef({
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    }),
  );
  if (otherCoins.length > 0) tx.mergeCoins(mainCoin, otherCoins);

  return tx.splitCoins(
    mainCoin,
    amounts.map((amount) => tx.pure.u64(amount)),
  );
}
