import { Keypair } from "@mysten/sui/cryptography";
import {
  Transaction,
  TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { logger } from "../lib/logger";

export const transfer = async (
  client: SuiClient,
  signer: Keypair,
  objectId: string,
  recipient: string,
) => {
  const tx = new Transaction();
  tx.transferObjects([tx.object(objectId)], recipient);

  const resp = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
  });
  const digest = resp.digest;

  logger.info({ action: "transferObject", objectId, recipient, digest });
};
