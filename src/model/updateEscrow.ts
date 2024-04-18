import { PrismaClient } from "@prisma/client";
import { DcaStatus, EscrowOrderEvent, TransactionAction, TransactionStatus } from "../type";

export const updateEscrowEvent = async (prisma: PrismaClient, event: EscrowOrderEvent, digest: string, checkpoint: number, timestamp: Date) => {
    await prisma.$transaction([
        prisma.dca.create({
            data: {
                escrowId: event.escrow,
                escrowDigest: digest,
                owner: event.owner,
                inputType: event.input_type,
                outputType: event.output_type,
                minPrice: event.min_price,
                maxPrice: event.max_price,
                baseTotal: event.amount,
                baseRemain: event.amount,
                quoteReceived: "0",
                ordersTotal: Number(event.orders),
                ordersExecuted: 0,
                retryCount: 0,
                frequency: Number(event.frequency),
                status: DcaStatus.Pending,
                createdAt: timestamp,
                updatedAt: timestamp,
            },
        }),
        prisma.transaction.create({
            data: {
                objectId: event.escrow,
                transactionHash: digest,
                blockNumber: checkpoint,
                action: TransactionAction.Place,
                status: TransactionStatus.Successed,
                createdAt: timestamp,
                updatedAt: timestamp,
            },
        }),
    ]);
}