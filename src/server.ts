import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Keypair } from "@mysten/sui.js/cryptography";
import { logger } from "./lib/logger";
import {
  BucketClient,
} from "bucket-protocol-sdk";
import { CloseOrderEvent, DcaStatus, ErrorCode, ExecuteOrderEvent, OrderStatus, TransactionAction, TransactionStatus } from "./type";

import { PrismaClient } from "@prisma/client";
import { closeOrder, executeOrder } from "./transactions";
import { ORDER_CLOSED_EVENT, ORDER_EXECUTED_EVENT } from "./config";
import { updateCloseEvent } from "./model/updateClose";
import { updateExecuteEvent } from "./model/updateExecute";
import { TIME_WINDOW } from "./constants";
import prisma from "./lib/prisma";

export class DCAServer {
  private keypair: Keypair;
  private client: SuiClient;
  private bucketClient: BucketClient = new BucketClient();
  public prices: { [key: string]: number } | null = null;

  constructor(keypair: Keypair) {
    this.keypair = keypair;
    this.client = new SuiClient({ url: getFullnodeUrl("mainnet") });
  }

  async getPrices() {
    try {
      this.prices = await this.bucketClient.getPrices();
    } catch (error) {
      logger.warn(error, "fetchPrice fail");
    }
  }

  async checkpoint() {

    const dcas = await prisma.dca.findMany({
      where: {
        status: {
          in: [DcaStatus.Pending, DcaStatus.InProgress]
        }
      }
    });
    if (dcas.length == 0) {
      return;
    }

    logger.debug(`Pending DCAs: ${dcas.length}`);

    const now = new Date().getTime();
    for (const dca of dcas) {
      if (now >= (dca.createdAt.getTime() + dca.frequency * dca.ordersTotal * 1000 + TIME_WINDOW)) {
        const ret = await closeOrder(this.client, this.keypair, dca);
        if (ret && ret.status == ErrorCode.SUCCESS && ret.data) {
          let { events, digest, checkpoint, timestamp } = ret.data;
          if (events) {
            for (const _event of events) {
              if (_event.type.startsWith(ORDER_CLOSED_EVENT)) {
                let event = _event.parsedJson as CloseOrderEvent;
                await updateCloseEvent(prisma, event, digest, Number(checkpoint), timestamp);
              }
            }
          }
        }
      }
      else if (!dca.lastExecuted
        || now >= (dca.lastExecuted.getTime() + dca.frequency * 1000)
      ) {
        const ret = await executeOrder(this.client, this.keypair, dca, dca.ordersTotal - dca.ordersExecuted == 1);
        if (ret && ret.status == ErrorCode.SUCCESS && ret.data) {
          let { events, digest, checkpoint, timestamp } = ret.data;
          if (events) {
            for (const _event of events) {
              if (_event.type.startsWith(ORDER_EXECUTED_EVENT)) {
                let event = _event.parsedJson as ExecuteOrderEvent;
                await updateExecuteEvent(prisma, event, digest, Number(checkpoint), timestamp);
              }
              else if (_event.type.startsWith(ORDER_CLOSED_EVENT)) {
                let event = _event.parsedJson as CloseOrderEvent;
                await updateCloseEvent(prisma, event, digest, Number(checkpoint), timestamp);
              }
            }
          }
        }
      }
    }
  }

}
