import {
  SuiClient,
  SuiObjectResponse,
  SuiTransactionBlock,
  SuiTransactionBlockResponse,
} from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { feeBalance, totalEscrows } from "./lib/operation";
import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { bcs, extractGenericType, sleep } from "./utils";
import { DECIMAL_PLACES, DUMMY_ADDRESS } from "./constants";
import { COIN } from "bucket-protocol-sdk";

export async function getFeeBalance(
  suiClient: SuiClient,
  type: COIN,
): Promise<number> {
  let tx = new Transaction();
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

export async function getTransaction(
  suiClient: SuiClient,
  digest: string,
): Promise<SuiTransactionBlockResponse | undefined> {
  for (let i = 0; i < 10; i++) {
    try {
      let res = await suiClient.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return res;
    } catch {
      await sleep(1000);
    }
  }

  return undefined;
}
