import { Keypair } from "@mysten/sui.js/cryptography";
import { TransactionBlock, TransactionObjectArgument } from "@mysten/sui.js/transactions";
import { SuiClient } from "@mysten/sui.js/client";
import { logger } from "../lib/logger";

export const transfer = async (
    client: SuiClient,
    signer: Keypair,
    objectId: string,
    recipient: string,
) => {
    const tx = new TransactionBlock();
    tx.transferObjects([
        tx.object(objectId)
    ], recipient);

    const resp = await client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer,
    });
    const digest = resp.digest;

    logger.info({ action: "transferObject", objectId, recipient, digest });

}
