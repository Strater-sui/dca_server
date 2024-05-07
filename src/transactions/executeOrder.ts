import { Keypair } from "@mysten/sui.js/cryptography";
import { TransactionBlock, TransactionObjectArgument } from "@mysten/sui.js/transactions";
import { BucketClient, getCoinSymbol } from "bucket-protocol-sdk";
import { dcaClearEscrow, dcaExecuteOrder, dcaRepayOrder } from "../lib/operation";
import { SuiClient } from "@mysten/sui.js/client";
import { logger } from "../lib/logger";
import { extractErrorMessage } from "../utils";
import { afSwap } from "../lib/aftermath";
import { Dca } from "@prisma/client";
import { AF_SLIPPAGE, DCA_PACKAGE } from "../constants";
import { ErrorCode } from "../type";
import { getTransaction } from "../getter";

export const executeOrder = async (
    client: SuiClient,
    signer: Keypair,
    escrow: Dca,
    closed = false,
) => {
    const bucketClient = new BucketClient();
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
            id: escrowId
        });
        if (escrowObj.error) {
            logger.error({ action: "closeOrder", escrow: escrow.escrowId, error: "Escrow not exists" });

            return {
                status: ErrorCode.NOT_FOUND,
            };
        }

        // Update price oracle for input & output pair
        const tx = new TransactionBlock();
        bucketClient.updateSupraOracle(tx, inputToken);
        bucketClient.updateSupraOracle(tx, outputToken);

        // Execute order
        const [coinIn, receipt] = dcaExecuteOrder(tx, {
            inputType,
            outputType,
            escrowId,
        });

        const inAmount = BigInt(Number(escrow.baseTotal) / escrow.ordersTotal);

        // Swap using aftermath
        const coinOut = await afSwap(tx, {
            senderAddress,
            inputType,
            outputType,
            coinInAmount: inAmount,
            coinIn,
            slippage: AF_SLIPPAGE,
        });
        if (!coinOut) return undefined;

        // Repay order
        dcaRepayOrder(tx, {
            inputType,
            outputType,
            escrowId,
            receipt,
            coinOut: coinOut as TransactionObjectArgument,
        });

        if (closed) {
            dcaClearEscrow(tx, {
                inputType,
                outputType,
                escrowId,
            });
        }

        const result = await client.devInspectTransactionBlock({
            transactionBlock: tx,
            sender: senderAddress,
        });

        if (result.effects.status.status == "success") {
            const resp = await client.signAndExecuteTransactionBlock({
                transactionBlock: tx,
                signer,
                requestType: 'WaitForEffectsCert'
            });
            const digest = resp.digest;

            // get transaction validate
            const transaction = await getTransaction(client, digest);
            if (!transaction) {
                return {
                    status: ErrorCode.FAILED_FETCH,
                };
            }

            const events = transaction.events?.filter(t => t.packageId == DCA_PACKAGE);
            logger.info({ action: "executeOrder", escrow: escrow.escrowId, digest });

            return {
                status: ErrorCode.SUCCESS,
                data: {
                    digest,
                    events,
                    checkpoint: transaction.checkpoint,
                    timestamp: new Date(Number(transaction.timestampMs))
                }
            };
        } else {
            // Error handling
            // tx.blockData.transactions.forEach((tx, id) => console.log(id, tx));
            if (result.effects.status.error) {
                const [functionName, errorCode] = extractErrorMessage(
                    result.effects.status.error,
                );

                if (errorCode) {
                    logger.error({ action: "executeOrder", escrowId, error: errorCode });
                }
                else {
                    logger.error({ action: "executeOrder", escrowId, error: result.effects.status.error });
                }

                // Error
                if (functionName == "execute_order") {
                    return {
                        status: errorCode,
                    };
                }
            }
        }
    }
    catch (ex) {
        logger.error({ action: "executeOrder", escrowId, error: ex });
        return {
            status: ErrorCode.UNKNOWN_ERROR
        }
    }
}
