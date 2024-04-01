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
import { Escrow } from "../type";
import { isEscrow } from "../utils";
import { SuiClient } from "@mysten/sui.js/client";

export function dcaPlaceOrder(
  tx: TransactionBlock,
  inputs: {
    owner: string;
    coin: TransactionObjectArgument;
    inputType: COIN;
    outputType: COIN;
    frequency: number;
    orders: number;
    priceEnabled: boolean;
    minPrice: string;
    maxPrice: string;
  },
): [TransactionObjectArgument] {
  const {
    owner,
    coin,
    inputType,
    outputType,
    frequency,
    orders,
    priceEnabled,
    minPrice,
    maxPrice,
  } = inputs;
  const [escrow] = tx.moveCall({
    target: DCA_CONFIG.targets.placeOrder,
    typeArguments: [COINS_TYPE_LIST[inputType], COINS_TYPE_LIST[outputType]],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.pure(owner, "address"),
      coin,
      tx.object(COIN_METADATA[inputType]),
      tx.object(COIN_METADATA[outputType]),
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

export function dcaFinalizeNewEscrow(
  tx: TransactionBlock,
  inputs: {
    inputType: COIN;
    outputType: COIN;
    escrow: TransactionObjectArgument;
    receipt: TransactionArgument;
    coinY: TransactionObjectArgument;
  },
) {
  const { escrow, receipt, coinY, inputType, outputType } = inputs;
  tx.moveCall({
    target: DCA_CONFIG.targets.finalizeNewEscrow,
    typeArguments: [COINS_TYPE_LIST[inputType], COINS_TYPE_LIST[outputType]],
    arguments: [tx.sharedObjectRef(DCA_CONFIG.DCA_REG), escrow, receipt, coinY],
  });
}

export function dcaExecuteOrder(
  tx: TransactionBlock,
  inputs: {
    inputType: COIN;
    outputType: COIN;
    escrow: Escrow | TransactionObjectArgument;
  },
): [TransactionObjectArgument, TransactionArgument] {
  const { inputType, outputType, escrow } = inputs;
  const [coinX, receipt] = tx.moveCall({
    target: DCA_CONFIG.targets.executeOrder,
    typeArguments: [COINS_TYPE_LIST[inputType], COINS_TYPE_LIST[outputType]],
    arguments: [
      isEscrow(escrow)
        ? tx.sharedObjectRef({
            objectId: escrow.id,
            initialSharedVersion: escrow.initial_shared_version,
            mutable: true,
          })
        : escrow,
      tx.sharedObjectRef(ORACLE_OBJECT),
      tx.sharedObjectRef(CLOCK_OBJECT),
    ],
  });

  return [coinX, receipt];
}
export function dcaRepayOrder(
  tx: TransactionBlock,
  inputs: {
    inputType: COIN;
    outputType: COIN;
    escrow: Escrow | TransactionObjectArgument;
    receipt: TransactionArgument;
    coinY: TransactionObjectArgument;
  },
) {
  const { inputType, outputType, escrow, receipt, coinY } = inputs;
  tx.moveCall({
    target: DCA_CONFIG.targets.repayOrder,
    typeArguments: [COINS_TYPE_LIST[inputType], COINS_TYPE_LIST[outputType]],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      isEscrow(escrow) ? tx.object(escrow.id) : escrow,
      receipt,
      coinY,
    ],
  });
}

export function dcaCloseEscrow(
  tx: TransactionBlock,
  inputs: {
    inputType: COIN;
    outputType: COIN;
    escrow: Escrow;
  },
): [TransactionObjectArgument, TransactionObjectArgument] {
  const { inputType, outputType, escrow } = inputs;
  const [coinX, coinY] = tx.moveCall({
    target: DCA_CONFIG.targets.closeEscrow,
    typeArguments: [COINS_TYPE_LIST[inputType], COINS_TYPE_LIST[outputType]],
    arguments: [
      tx.sharedObjectRef(DCA_CONFIG.DCA_REG),
      tx.sharedObjectRef({
        objectId: escrow.id,
        initialSharedVersion: escrow.initial_shared_version,
        mutable: true,
      }),
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
