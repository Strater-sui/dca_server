import { SuiClient, SuiObjectResponse } from "@mysten/sui.js/client";
import { Escrow } from "./type";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { feeBalance, totalEscrows } from "./lib/operation";
import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui.js/utils";
import { FLOAT_SCALING, bcs, extractGenericType } from "./utils";
import { DECIMAL_PLACES, DUMMY_ADDRESS } from "./constants";
import { COIN } from "bucket-protocol-sdk";

export async function getTotalEscrows(client: SuiClient): Promise<Escrow[]> {
  let tx = new TransactionBlock();
  totalEscrows(tx);

  let res = await client.devInspectTransactionBlock({
    sender: DUMMY_ADDRESS,
    transactionBlock: tx,
  });
  const returnValues = res?.results?.[0]?.returnValues;
  if (!returnValues || returnValues?.[0][0][0] === 0) {
    return [];
  } else {
    const valueType = returnValues[0][1];
    const valueData = returnValues[0][0];
    const ids = bcs.de(
      valueType,
      Uint8Array.from(valueData as Iterable<number>),
    );

    const objects = await client.multiGetObjects({
      ids,
      options: { showType: true, showContent: true, showOwner: true },
    });
    return objects
      .map(suiObjectToEscrow)
      .filter((obj) => obj !== null) as Escrow[];
  }
}
export async function getFeeBalance(
  suiClient: SuiClient,
  type: COIN,
): Promise<number> {
  let tx = new TransactionBlock();
  feeBalance(tx, type);
  let res = await suiClient.devInspectTransactionBlock({
    sender: DUMMY_ADDRESS,
    transactionBlock: tx,
  });

  const returnValues = res?.results?.[0]?.returnValues;
  if (!returnValues || returnValues?.[0][0][0] === 0) {
    return 0;
  } else {
    const valueType = returnValues[0][1];
    const valueData = returnValues[0][0];
    return Number(
      bcs.de(valueType, Uint8Array.from(valueData as Iterable<number>)),
    );
  }
}

export function suiObjectToEscrow(resp: SuiObjectResponse): Escrow | null {
  if (resp.error || !resp.data) {
    return null;
  }

  const owner = resp.data.owner as any;
  if (!owner) {
    throw new Error(
      "Missing owner. Make sure to fetch the object with `showOwner: true`",
    );
  }

  // if (!owner?.Shared?.initial_shared_version) {
  //   throw new Error(
  //     "Missing owner. Make sure to fetch the object with `showOwner: true`",
  //   );
  // }
  const content = resp.data.content;
  if (!content) {
    throw new Error(
      "Missing object content. Make sure to fetch the object with `showContent: true`",
    );
  }
  if (content.dataType !== "moveObject") {
    throw new Error(
      `Wrong object dataType. Expected 'moveObject' but got: '${content.dataType}'`,
    );
  }

  const type = extractGenericType(resp.data.type as string);
  if (!type) {
    throw new Error(
      "Missing object type. Make sure to fetch the object with `showType: true`",
    );
  }

  const fields = content.fields as any;
  const [typeX, typeY] =
    type.split(",").map((t) => normalizeStructTag(t.trim())) ?? [];

  return {
    id: fields.id.id,
    initial_shared_version: owner.Shared.initial_shared_version,
    typeX,
    typeY,
    owner: fields.owner,
    frequency: Number(fields.frequency),
    divided_amount: Number(fields.divided_amount),
    last_claimed: Number(fields.last_claimed),
    filled_orders: Number(fields.filled_orders),
    balance_x: Number(fields.balance_x),
    balance_y: Number(fields.balance_y),
    decimals_x: Number(fields.decimals_x),
    decimals_y: Number(fields.decimals_y),
    price_enabled: fields.price_enabled,
    min_price: Number(fields.min_price),
    max_price: Number(fields.max_price),
    deposit_time: Number(fields.deposit_time),
    end_time: Number(fields.end_time),
    total_spent: Number(fields.total_spent),
    total_withdrawn_amount: Number(fields.total_withdrawn_amount),
    executed_time: Number(fields.deposit_time) + Number(fields.frequency),
  };
}

export function escrowToDatabaseValue(escrow: Escrow) {
  return {
    objectID: escrow.id,
    initialSharedVersion: escrow.initial_shared_version,
    typeX: escrow.typeX,
    typeY: escrow.typeY,
    owner: escrow.owner,
    frequency: escrow.frequency,
    dividedAmount: escrow.divided_amount,
    lastClaimed: escrow.last_claimed,
    filledOrders: escrow.filled_orders,
    balanceX: escrow.balance_x,
    balanceY: escrow.balance_y,
    decimalsX: escrow.decimals_x,
    decimalsY: escrow.decimals_y,
    priceEnabled: escrow.price_enabled,
    minPrice: escrow.min_price,
    maxPrice: escrow.max_price,
    depositTime: escrow.deposit_time,
    endTime: escrow.end_time,
    totalSpent: escrow.total_spent,
    totalWithdrawnAmount: escrow.total_withdrawn_amount,
    executedTime: escrow.executed_time,
  };
}

export function databaseValueToEscrow(data: any): Escrow {
  return {
    id: data.objectID,
    initial_shared_version: data.initialSharedVersion,
    typeX: data.typeX,
    typeY: data.typeY,
    owner: data.owner,
    frequency: data.frequency,
    divided_amount: data.dividedAmount,
    last_claimed: data.lastClaimed,
    filled_orders: data.filledOrders,
    balance_x: data.balanceX,
    balance_y: data.balanceY,
    decimals_x: data.decimalsX,
    decimals_y: data.decimalsY,
    price_enabled: data.priceEnabled,
    min_price: data.minPrice,
    max_price: data.maxPrice,
    deposit_time: data.depositTime,
    end_time: data.endTime,
    total_spent: data.totalSpent,
    total_withdrawn_amount: data.totalWithdrawnAmount,
    executed_time: data.executedTime,
  };
}

// utils
export function getEpochTime(escrow: Escrow): number {
  return escrow.deposit_time + escrow.frequency * getEpoch(escrow);
}
export function getEpoch(escrow: Escrow): number {
  return Math.floor(
    (new Date().getTime() / 1000 - escrow.deposit_time) / escrow.frequency,
  );
}
