import { PrismaClient } from "@prisma/client";
import { DcaStatus, ExecuteOrderEvent, OrderStatus, TransactionAction, TransactionStatus } from "../type";

export const updateExecuteEvent = async (prisma: PrismaClient, event: ExecuteOrderEvent, digest: string, checkpoint: number, timestamp: Date) => {

    await prisma.$transaction([
        prisma.order.create({
            data: {
                escrowId: event.escrow,
                executeDigest: digest,
                inAmount: event.spent_x,
                outAmount: event.withdrawn_y,
                status: OrderStatus.Successed,
                createdAt: timestamp,
                updatedAt: timestamp,
            },
        }),
        prisma.transaction.create({
            data: {
                objectId: event.escrow,
                transactionHash: digest,
                blockNumber: checkpoint,
                action: TransactionAction.Execute,
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
                baseRemain: event.balance_x,
                quoteReceived: event.withdrawn_y,
                status: DcaStatus.InProgress,
                ordersExecuted: Number(event.executed_order),
                lastExecuted: timestamp,
                updatedAt: timestamp,
            },
        })
    ]);
}