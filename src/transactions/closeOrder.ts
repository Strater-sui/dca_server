import { Keypair } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { getCoinSymbol } from "bucket-protocol-sdk";
import { dcaClearEscrow, dcaCloseEscrow } from "../lib/operation";
import { SuiClient } from "@mysten/sui/client";
import { logger } from "../lib/logger";
import { Dca } from "@prisma/client";
import { ErrorCode } from "../type";
import { DCA_PACKAGE } from "../constants";
import { extractErrorMessage } from "../utils";
import { getTransaction } from "../getter";

export const closeOrder = async (
  client: SuiClient,
  signer: Keypair,
  escrow: Dca,
) => {
  const senderAddress = signer.toSuiAddress();

  const { escrowId, inputType, outputType } = escrow;

  const inputToken = getCoinSymbol(inputType);
  const outputToken = getCoinSymbol(outputType);
  if (!inputToken || !outputToken) {
    return;
  }

  try {
    // Before close order, validate escrowId exists
    const escrowObj = await client.getObject({
      id: escrowId,
    });
    if (escrowObj.error) {
      logger.error({
        action: "closeOrder",
        escrow: escrow.escrowId,
        error: "Escrow not exists",
      });

      return {
        status: ErrorCode.NOT_FOUND,
      };
    }

    // Close order
    const tx = new Transaction();
    dcaClearEscrow(tx, {
      inputType,
      outputType,
      escrowId,
    });

    const result = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: senderAddress,
    });

    if (result.effects.status.status == "success") {
      const resp = await client.signAndExecuteTransaction({
        transaction: tx,
        signer,
        requestType: "WaitForEffectsCert",
      });
      const digest = resp.digest;

      // get transaction validate
      const transaction = await getTransaction(client, digest);
      if (!transaction) {
        return {
          status: ErrorCode.FAILED_FETCH,
        };
      }

      const events = transaction.events?.filter(
        (t) => t.packageId == DCA_PACKAGE,
      );
      logger.info({ action: "closeOrder", escrow: escrow.escrowId, digest });

      return {
        status: ErrorCode.SUCCESS,
        data: {
          digest,
          events,
          checkpoint: transaction.checkpoint,
          timestamp: new Date(Number(transaction.timestampMs)),
        },
      };
    } else {
      // Error handling
      // tx.blockData.transactions.forEach((tx, id) => console.log(id, tx));
      if (result.effects.status.error) {
        const [functionName, errorCode] = extractErrorMessage(
          result.effects.status.error,
        );

        // Error
        if (functionName == "close_order") {
          return {
            status: errorCode,
          };
        }

        if (errorCode) {
          logger.error({ action: "closeOrder", escrowId, error: errorCode });
        } else {
          logger.error({
            action: "closeOrder",
            escrowId,
            error: result.effects.status.error,
          });
        }
      }
    }
  } catch (ex) {
    logger.error({ action: "closeOrder", escrowId, error: ex });
    return {
      status: ErrorCode.UNKNOWN_ERROR,
    };
  }
};
