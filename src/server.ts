import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Keypair } from "@mysten/sui.js/cryptography";
import { logger } from "./lib/logger";
import {
  BucketClient,
} from "bucket-protocol-sdk";
import { CloseOrderEvent, DcaStatus, ErrorCode, ExecuteOrderEvent } from "./type";

import { closeOrder, executeOrder } from "./transactions";
import { ORDER_CLOSED_EVENT, ORDER_EXECUTED_EVENT } from "./config";
import { updateCloseEvent } from "./model/updateClose";
import { updateExecuteEvent } from "./model/updateExecute";
import { CHUNK_SIZE, MAX_RETRY_COUNT, TIME_WINDOW } from "./constants";
import prisma from "./lib/prisma";
import { Dca } from "@prisma/client";

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

    const batchDcas: Dca[][] = [];
    for (let i = 0; i < dcas.length; i += CHUNK_SIZE) {
      batchDcas.push(dcas.slice(i, i + CHUNK_SIZE));
    }
    for (const chunkDcas of batchDcas) {
      await Promise.all(chunkDcas.map(dca => this.processOrder(dca)));
    }
  }

  async processOrder(dca: Dca) {
    const now = new Date().getTime();

    // Is expired
    if (now >= (dca.createdAt.getTime() + dca.frequency * dca.ordersTotal * 1000 + TIME_WINDOW)) {
      const ret = await closeOrder(this.client, this.keypair, dca);
      if (ret) {
        if (ret.status == ErrorCode.SUCCESS && ret.data) {
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
        else if (ret.status == ErrorCode.NOT_FOUND) {
          await prisma.dca.update({
            data: {
              status: DcaStatus.Completed,
              updatedAt: new Date(),
            },
            where: {
              escrowId: dca.escrowId
            }
          })
        }
        else {
          await prisma.dca.update({
            data: {
              retryCount: dca.retryCount + 1,
              status: dca.retryCount >= MAX_RETRY_COUNT ? DcaStatus.Failed : dca.status,
              updatedAt: new Date(),
            },
            where: {
              escrowId: dca.escrowId
            }
          })
        }
      }
    }
    else if (now >= (dca.createdAt.getTime() + dca.frequency * (dca.ordersExecuted + 1) * 1000)) {
      const isLastOrder = dca.ordersTotal - dca.ordersExecuted == 1;
      const ret = await executeOrder(this.client, this.keypair, dca, isLastOrder);
      if (ret) {
        if (ret.status == ErrorCode.SUCCESS && ret.data) {
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
        else if (ret.status == ErrorCode.NOT_FOUND) {
          await prisma.dca.update({
            data: {
              status: DcaStatus.Completed,
              updatedAt: new Date(),
            },
            where: {
              escrowId: dca.escrowId
            }
          })
        }
        else {
          await prisma.dca.update({
            data: {
              retryCount: dca.retryCount + 1,
              status: dca.retryCount >= MAX_RETRY_COUNT ? DcaStatus.Failed : dca.status,
              updatedAt: new Date(),
            },
            where: {
              escrowId: dca.escrowId
            }
          })
        }

        await prisma.executeLog.create({
          data: {
            escrowId: dca.escrowId,
            digest: ret.data?.digest ?? null,
            errorCode: ret.status as number,
            createdAt: new Date(),
          },
        })
      }
    }
  }

}
