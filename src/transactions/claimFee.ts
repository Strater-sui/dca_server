import { Keypair } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { COIN } from "bucket-protocol-sdk";
import { dcaClaimFee } from "../lib/operation";
import { SuiClient } from "@mysten/sui/client";
import { logger } from "../lib/logger";
import { DCA_CONFIG } from "../config";
import { getFeeBalance } from "../getter";

export const claimFee = async (
  client: SuiClient,
  signer: Keypair,
  token: COIN,
) => {
  const senderAddress = signer.toSuiAddress();
  let tx = new Transaction();

  const feeBalanceValue = await getFeeBalance(client, token);

  const res = await client.getOwnedObjects({
    owner: senderAddress,
    filter: {
      MatchAll: [{ StructType: DCA_CONFIG.DCA_CAP }],
    },
  });

  const cap = res.data[0].data?.objectId;
  if (!cap) {
    throw new Error("No DCA_CAP object");
  }
  dcaClaimFee(tx, token, cap, feeBalanceValue);

  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: senderAddress,
  });

  if (result.effects.status.status == "success") {
    let resp = await client.signAndExecuteTransaction({
      transaction: tx,
      signer,
      requestType: "WaitForLocalExecution",
      options: {
        showEffects: true,
      },
    });

    let txHash = resp.digest;
    logger.info(`ClaimFee txHash: ${txHash}`);
  } else {
    // Error handling
    logger.error({ action: "claimFee", error: result.error });
  }
};
