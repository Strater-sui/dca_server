import { Keypair } from "@mysten/sui.js/cryptography";
import {
  TransactionArgument,
  TransactionBlock,
} from "@mysten/sui.js/transactions";
import {
  BucketClient,
  COIN,
  COINS_TYPE_LIST,
  COIN_DECIMALS,
  getCoinSymbol,
  getInputCoins,
} from "bucket-protocol-sdk";
import { dcaPlaceOrder } from "../lib/operation";
import { SuiClient, SuiObjectChange } from "@mysten/sui.js/client";
import { logger } from "../lib/logger";
import { extractErrorMessage } from "../utils";
import { DCA_PACKAGE } from "../constants";
import { ErrorCode, EscrowOrderEvent } from "../type";
import { ORDER_CREATED_EVENT } from "../config";
import { getTransaction } from "../getter";

export async function splitCoins(
  client: SuiClient,
  signer: Keypair,
  inputToken: COIN,
  amount: number,
  escrows: number,
) {
  const owner = signer.toSuiAddress();
  const tx = new TransactionBlock();

  const inputAmount = Number(amount * 10 ** COIN_DECIMALS[inputToken]);
  const totalAmount = inputAmount * escrows;
  const mainCoin = await getInputCoins(
    tx,
    client,
    owner,
    COINS_TYPE_LIST[inputToken],
    totalAmount,
  );

  const coins = tx.splitCoins(
    mainCoin,
    Array(escrows).fill(tx.pure(inputAmount)),
  );

  const inputCoins = coins.map((coin) => coin);
  tx.transferObjects(inputCoins, tx.pure(owner));

  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: owner,
  });
  const resp = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer,
    requestType: "WaitForEffectsCert",
  });

  console.log("resp", resp);
}
