import { Keypair } from "@mysten/sui.js/cryptography";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { BucketClient, COIN, COINS_TYPE_LIST, COIN_DECIMALS, getCoinSymbol, getInputCoins } from "bucket-protocol-sdk";
import { dcaPlaceOrder } from "../lib/operation";
import { SuiClient, SuiObjectChange } from "@mysten/sui.js/client";
import { logger } from "../lib/logger";
import { extractErrorMessage } from "../utils";
import { DCA_PACKAGE } from "../constants";
import { ErrorCode, EscrowOrderEvent } from "../type";
import { ORDER_CREATED_EVENT } from "../config";
import { getTransaction } from "../getter";

export const placeOrder = async (
    client: SuiClient,
    signer: Keypair,
    inputToken: COIN,
    outputToken: COIN,
    amount: number,
    frequency: number,
    orders: number,
) => {
    const owner = signer.toSuiAddress();
    const tx = new TransactionBlock();

    const inputAmount = Number(amount * 10 ** COIN_DECIMALS[inputToken]);
    const inputCoin = await getInputCoins(tx, client, owner, COINS_TYPE_LIST[inputToken], inputAmount);

    // create Escrow order
    const [escrow] = dcaPlaceOrder(tx, {
        owner,
        inputCoin,
        inputToken,
        outputToken,
        frequency,
        orders,
        priceEnabled: false,
        minPrice: "0",
        maxPrice: "0",
        /*
        priceEnabled: minPrice !== null && maxPrice !== null,
        minPrice: Math.floor((minPrice ?? 0) * FLOAT_SCALING).toString(),
        maxPrice: Math.floor((maxPrice ?? 0) * FLOAT_SCALING).toString(),
        */
    });

    const result = await client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: owner,
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
        const escrow = (events?.find(t => t.type.startsWith(ORDER_CREATED_EVENT))?.parsedJson as EscrowOrderEvent).escrow;
        logger.info({ action: "placeOrder", digest, escrow });

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

            // Error
            if (functionName == "create_order") {
                return {
                    status: errorCode,
                };
            }

            logger.error({ action: "createOrder", error: errorCode },);
        }
    }
}
