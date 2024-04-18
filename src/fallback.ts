require("dotenv").config();

import { PrismaClient } from "@prisma/client";
import { logger } from "./lib/logger";
import { sleep } from "./utils";
import { getCreatedOrders, getClosedOrders, getExecutedOrders } from "./sentio";
import { TransactionAction } from "./type";
import { updateCloseEvent } from "./model/updateClose";
import { updateExecuteEvent } from "./model/updateExecute";
import { updateEscrowEvent } from "./model/updateEscrow";

const fetchEscrowEvents = async (
  prisma: PrismaClient
) => {
  try {
    // Get last dca
    const lastTx = await prisma.transaction.findFirst({
      where: {
        action: TransactionAction.Place
      },
      orderBy: {
        blockNumber: 'desc'
      }
    });

    let blockNumber = 0;
    if (lastTx) {
      blockNumber = lastTx.blockNumber;
    }

    const events = await getCreatedOrders(blockNumber);
    if (events.length > 0) {
      for (const event of events) {
        await updateEscrowEvent(prisma, event, event.transaction_hash, event.block_number, new Date(event.timestamp));
      }

      logger.info(`Fetch ${events.length} new escrows`);
    };
  }
  catch (ex) {
    logger.error(`Fetch EscrowEvents: ${ex}`);
  }
}

const fetchExecutedEvents = async (
  prisma: PrismaClient
) => {
  try {
    // Get last dca
    const lastTx = await prisma.transaction.findFirst({
      where: {
        action: TransactionAction.Execute
      },
      orderBy: {
        blockNumber: 'desc'
      }
    });

    let blockNumber = 0;
    if (lastTx) {
      blockNumber = lastTx.blockNumber;
    }

    const events = await getExecutedOrders(blockNumber);
    if (events.length > 0) {
      for (const event of events) {
        await updateExecuteEvent(prisma, event, event.transaction_hash, event.block_number, new Date(event.timestamp));
      }

      logger.info(`Fetch ${events.length} executed orders`);
    };
  }
  catch (ex) {
    logger.error(`Fetch ExecutedEvents: ${ex}`);
  }
}

const fetchClosedEvents = async (
  prisma: PrismaClient
) => {
  try {
    // Get last dca
    const lastTx = await prisma.transaction.findFirst({
      where: {
        action: TransactionAction.Close
      },
      orderBy: {
        blockNumber: 'desc'
      }
    });

    let blockNumber = 0;
    if (lastTx) {
      blockNumber = lastTx.blockNumber;
    }

    const events = await getClosedOrders(blockNumber);
    if (events.length > 0) {
      for (const event of events) {

        const dca = await prisma.dca.findFirst({
          where: {
            escrowId: event.escrow,
          }
        });
        if (!dca) {
          logger.error(`DCA not exists for ${event.escrow}`);
          continue;
        }

        await updateCloseEvent(prisma, event, event.transaction_hash, event.block_number, new Date(event.timestamp));
      }

      logger.info(`Fetch ${events.length} closed orders`);
    };

  }
  catch (ex) {
    logger.error(`Fetch ClosedEvents: ${ex}`);
  }
}

(async () => {
  const prisma = new PrismaClient();

  // Loop infinite
  while (true) {
    logger.info(`Fallback script running`);
    await fetchEscrowEvents(prisma);
    await fetchExecutedEvents(prisma);
    await fetchClosedEvents(prisma);

    // Wait 1 minitue for next run
    await sleep(1000 * 60);
  }

})();
