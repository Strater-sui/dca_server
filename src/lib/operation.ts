import {
  TransactionArgument,
  TransactionBlock,
  TransactionObjectArgument,
  TransactionResult,
} from "@mysten/sui.js/transactions";
import {
  ORACLE_OBJECT,
  CLOCK_OBJECT,
  COIN,
  COINS_TYPE_LIST,
  SUPRA_PRICE_FEEDS,
} from "bucket-protocol-sdk";
import { COIN_METADATA, DCA_BUCKET_CONFIG, DCA_CONFIG } from "../config";
import { SuiClient } from "@mysten/sui.js/client";

export function dcaPlaceOrder(
  tx: TransactionBlock,
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
      tx.pure(owner, "address"),
      inputCoin,
      tx.object(COIN_METADATA[inputToken]),
      tx.object(COIN_METADATA[outputToken]),
      tx.pure(frequency),
      tx.pure(orders),
      tx.pure(priceEnabled),
      tx.pure(minPrice, "u128"),
      tx.pure(maxPrice, "u128"),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });
  return [escrow];
}

export function dcaExecuteOrder(
  tx: TransactionBlock,
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
      tx.sharedObjectRef(ORACLE_OBJECT),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });

  return [coinX, receipt];
}
export function dcaRepayOrder(
  tx: TransactionBlock,
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
      tx.object(escrowId),
      receipt,
      coinOut,
    ],
  });
}

export function dcaCloseEscrow(
  tx: TransactionBlock,
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
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.object(escrowId),
    ],
  });
  return [coinX, coinY];
}

export function dcaClaimFee(
  tx: TransactionBlock,
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
      typeof amount === "number" ? tx.pure(amount, "u64") : amount,
    ],
  });
}

//Getter
export function totalEscrows(tx: TransactionBlock) {
  tx.moveCall({
    target: DCA_CONFIG.targets.totalEscrows,
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG)],
  });
}
export function feeBalance(tx: TransactionBlock, coin: COIN) {
  tx.moveCall({
    target: DCA_CONFIG.targets.feeBalance,
    typeArguments: [COINS_TYPE_LIST[coin]],
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG)],
  });
}

//Utils
export async function getInputCoins(
  tx: TransactionBlock,
  suiClient: SuiClient,
  owner: string,
  coinSymbol: COIN,
  ...amounts: number[]
): Promise<TransactionResult> {
  const coinType = COINS_TYPE_LIST[coinSymbol];
  if (coinType === COINS_TYPE_LIST.SUI) {
    return tx.splitCoins(
      tx.gas,
      amounts.map((amount) => tx.pure(amount, "u64")),
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
    amounts.map((amount) => tx.pure(amount, "u64")),
  );
}
