import { PrismaClient } from "@prisma/client";
import { CloseOrderEvent, DcaStatus, TransactionAction, TransactionStatus } from "../type";

export const updateCloseEvent = async (prisma: PrismaClient, event: CloseOrderEvent, digest: string, checkpoint: number, timestamp: Date) => {
    await prisma.$transaction([
        prisma.transaction.create({
            data: {
                objectId: event.escrow,
                transactionHash: digest,
                blockNumber: checkpoint,
                action: TransactionAction.Close,
                status: TransactionStatus.Successed,
                createdAt: timestamp,
                updatedAt: timestamp,
            },
        }),
        prisma.dca.update({
            where: {
                escrowId: event.escrow
            },
            data: {
                baseRemain: event.withdrawn_x,
                quoteReceived: event.withdrawn_y,
                updatedAt: timestamp,
                status: DcaStatus.Completed,
            },
        })
    ]);
}