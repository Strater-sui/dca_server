import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Keypair } from "@mysten/sui.js/cryptography";
import { logger } from "./logger";
import {
  SUI_FRAMEWORK_ADDRESS,
  normalizeSuiAddress,
} from "@mysten/sui.js/utils";
import { NeonHttpDatabase, drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { count } from "drizzle-orm";
import { NeonQueryFunction, neon } from "@neondatabase/serverless";
import {
  BucketClient,
  COIN,
  COINS_TYPE_LIST,
  COIN_DECIMALS,
  SUPRA_PRICE_FEEDS,
  getInputCoins,
} from "bucket-protocol-sdk";
import {
  TransactionBlock,
  TransactionObjectArgument,
} from "@mysten/sui.js/transactions";

import {
  dcaCloseVault,
  dcaExecuteOrder,
  dcaFinalizeNewVault,
  dcaPlaceOrder,
  dcaRepayOrder,
  totalVaults,
} from "./operation";
import { aftermathSwapByInput } from "./aftermath";
import {
  databaseValueToEscrow,
  escrowToDatabaseValue,
  getEpochTime,
  getTotalEscrows,
  suiObjectToEscrow,
} from "../getter";
import { FLOAT_SCALING, extractErrorMessage } from "../utils";
import { Escrow } from "../type";
import { ne, eq, lte, and } from "drizzle-orm";
import pLimit from "p-limit";
import { COIN_SYMBOLS } from "../config";
import { date } from "drizzle-orm/mysql-core";
const limit = pLimit(5);

export class DCAServer {
  private keypair: Keypair;
  private client: SuiClient;
  private db: NeonHttpDatabase<typeof schema>;
  private bucketClient: BucketClient = new BucketClient();
  public prices: { [key: string]: number } | null = null;
  public escrows: Record<string, Escrow> = {};
  public executingOrders: string[] = [];

  constructor(keypair: Keypair) {
    const sql: NeonQueryFunction<boolean, boolean> = neon(
      process.env.DATABASE_URL!,
    );
    this.keypair = keypair;
    this.client = new SuiClient({ url: getFullnodeUrl("mainnet") });
    this.db = drizzle(sql, { schema });
  }

  async getPrices() {
    try {
      this.prices = await this.bucketClient.getPrices();
    } catch (error) {
      logger.warn(error, "fetchPrice fail");
    }
  }

  async loadDatabase() {
    logger.info("loading database");
    this.escrows = {};
    this.executingOrders = [];
    const res = await this.db.select().from(schema.escrows);

    res.forEach(
      (data) => (this.escrows[data.objectID] = databaseValueToEscrow(data)),
    );

    logger.info({ escrows: this.escrows }, "query");
  }

  async seedDatabase() {
    logger.info("seeding database");
    await this.db.delete(schema.escrows);
    // onchain data fetching
    const escrows = await getTotalEscrows(this.client);

    // seed database
    if (!!escrows.length) {
      logger.info(escrows, "escrows");
      const escrowValues = escrows.map((escrow, id) =>
        escrowToDatabaseValue(escrow),
      );
      await this.db.insert(schema.escrows).values(escrowValues);
    } else {
      logger.info("empty escrows");
    }
  }

  async checkpoint() {
    let startTime = new Date().getTime();
    logger.info(`Time: ${startTime}`);

    this.escrows = {};
    this.executingOrders = [];

    const currentTime = Math.floor(new Date().getTime() / 1000);
    logger.info({ currentTime });

    let orderPromises: any[] = [];
    (
      await this.db
        .select()
        .from(schema.escrows)
        .where(ne(schema.escrows.balanceX, 0))
    )
      // .where(
      //   and(
      // filter valid order by checking expiration & executedTime
      //   lte(schema.escrows.lastClaimed, currentTime),
      //   lte(schema.escrows.executedTime, currentTime),
      // ),
      // )
      .forEach((data) => {
        const now = new Date().getTime() / 1000;
        if (!this.executingOrders.includes(data.objectID)) {
          if (
            data.endTime == data.lastClaimed &&
            data.executedTime < now &&
            data.endTime > now
          ) {
            //execute and close last order
            this.executingOrders.push(data.objectID);
            orderPromises.push(
              limit(() =>
                this.moveCallExectueOrder(
                  data.objectID,
                  COIN_SYMBOLS[data.typeX],
                  COIN_SYMBOLS[data.typeY],
                  false,
                ),
              ),
            );
            // } else if (data.endTime < now) {
            //   // close order
            //   this.executingOrders.push(data.objectID);
            //   orderPromises.push(
            //     limit(() =>
            //       this.moveCallCloseEscrow(
            //         data.objectID,
            //         COIN_SYMBOLS[data.typeX],
            //         COIN_SYMBOLS[data.typeY],
            //       ),
            //     ),
            //   );
          } else if (
            data.executedTime < now &&
            data.lastClaimed < now &&
            data.endTime > now
          ) {
            // executeOrder
            this.executingOrders.push(data.objectID);
            orderPromises.push(
              limit(() =>
                this.moveCallExectueOrder(
                  data.objectID,
                  COIN_SYMBOLS[data.typeX],
                  COIN_SYMBOLS[data.typeY],
                ),
              ),
            );
          }
        }
      });

    if (!!orderPromises.length) await Promise.all(orderPromises);

    logger.info({ orderPromises });

    const countRes = await this.db
      .select({ count: count() })
      .from(schema.escrows);
    logger.info(countRes[0].count, "total orders");
    logger.info({ pendinf: this.executingOrders }, "executingOrders");
  }

  async loop(duration: number, delay: number) {
    let startTime = new Date().getTime();
    logger.info(`Start at: ${startTime}`);

    this.escrows = {};
    this.executingOrders = [];

    while (new Date().getTime() - startTime < duration) {
      const currentTime = Math.floor(new Date().getTime() / 1000);
      logger.info({ currentTime });

      let orderPromises: any[] = [];
      (
        await this.db
          .select()
          .from(schema.escrows)
          .where(ne(schema.escrows.balanceX, 0))
      )
        // .where(
        //   and(
        // filter valid order by checking expiration & executedTime
        //   lte(schema.escrows.lastClaimed, currentTime),
        //   lte(schema.escrows.executedTime, currentTime),
        // ),
        // )
        .forEach((data) => {
          const now = new Date().getTime() / 1000;
          if (!this.executingOrders.includes(data.objectID)) {
            if (data.endTime == data.lastClaimed && data.executedTime < now) {
              //execute and close last order
              this.executingOrders.push(data.objectID);
              orderPromises.push(
                limit(() =>
                  this.moveCallExectueOrder(
                    data.objectID,
                    COIN_SYMBOLS[data.typeX],
                    COIN_SYMBOLS[data.typeY],
                    false,
                  ),
                ),
              );
              // } else if (data.endTime < now) {
              //   // close order
              //   this.executingOrders.push(data.objectID);
              //   orderPromises.push(
              //     limit(() =>
              //       this.moveCallCloseEscrow(
              //         data.objectID,
              //         COIN_SYMBOLS[data.typeX],
              //         COIN_SYMBOLS[data.typeY],
              //       ),
              //     ),
              //   );
            } else if (data.executedTime < now && data.lastClaimed < now) {
              // executeOrder
              this.executingOrders.push(data.objectID);
              orderPromises.push(
                limit(() =>
                  this.moveCallExectueOrder(
                    data.objectID,
                    COIN_SYMBOLS[data.typeX],
                    COIN_SYMBOLS[data.typeY],
                  ),
                ),
              );
            }
          }
        });

      if (!!orderPromises.length) await Promise.all(orderPromises);

      logger.info({ orderPromises });

      const countRes = await this.db
        .select({ count: count() })
        .from(schema.escrows);
      logger.info(countRes[0].count, "total orders");
      logger.info({ pendinf: this.executingOrders }, "executingOrders");

      await setTimeout(() => {}, delay);
    }
  }

  async socket() {
    this.loadDatabase();
    const pkg = process.env.DCA_PACKAGE!;
    logger.info(`listneing the pacakge: ${pkg}`);
    const unsubscribe = await this.client.subscribeEvent({
      filter: {
        Package: pkg,
      },
      onMessage: async (event) => {
        const eventType = event.type;
        const json = event.parsedJson as any;
        if (eventType.startsWith(`${pkg}::event::OrderExecuted`)) {
          const id = json.escrow;
          const response = await this.client.getObject({
            id,
            options: { showContent: true, showType: true, showOwner: true },
          });
          const escrow = suiObjectToEscrow(response);
          if (escrow !== null) {
            const value = escrowToDatabaseValue(escrow);
            if (Object.keys(this.escrows).includes(escrow.id)) {
              // Insert
              await this.db
                .update(schema.escrows)
                .set(value)
                .where(eq(schema.escrows.objectID, escrow.id));
            } else {
              // Update
              await this.db.insert(schema.escrows).values(value);
            }
          } else {
            logger.warn(
              "fail to compile Escrow Object from response: ",
              response,
            );
          }
        } else if (eventType.startsWith(`${pkg}::event::OrderClosed`)) {
          // delete from DB
          await this.db
            .delete(schema.escrows)
            .where(eq(schema.escrows.objectID, json.escrow));
        }
      },
    });

    // later, to unsubscribe:
    await unsubscribe();
  }

  // MoveCall
  async moveCallplaceOrder(
    inputType: COIN,
    outputType: COIN,
    amount_: number,
    frequency: number,
    orders: number,
    minPrice: number | null,
    maxPrice: number | null,
  ) {
    const senderAddress = this.keypair.toSuiAddress();
    let tx = new TransactionBlock();

    const amount = amount_ * 10 ** COIN_DECIMALS[inputType];
    const divedAmount = Math.floor(amount / orders);
    const coin = await getInputCoins(
      tx as any,
      this.client as any,
      senderAddress,
      COINS_TYPE_LIST[inputType],
      amount,
    );

    // create Escrow order
    const [escrow] = dcaPlaceOrder(tx, {
      owner: senderAddress,
      coin,
      inputType,
      outputType,
      frequency,
      orders,
      priceEnabled: minPrice !== null && maxPrice !== null,
      minPrice: Math.floor((minPrice ?? 0) * FLOAT_SCALING).toString(),
      maxPrice: Math.floor((maxPrice ?? 0) * FLOAT_SCALING).toString(),
    });

    this.bucketClient.updateSupraOracle(tx as any, inputType);
    this.bucketClient.updateSupraOracle(tx as any, outputType);

    // execute order
    const [coinX, receipt] = dcaExecuteOrder(tx, {
      inputType,
      outputType,
      escrow,
    });

    // swap
    let coinY = await aftermathSwapByInput(tx, {
      senderAddress,
      coinInSymbol: inputType,
      coinOutSymbol: outputType,
      coinInAmount: BigInt(divedAmount),
      coinIn: coinX,
      slippage: 1,
    });
    if (!coinY) return undefined;

    // finalize the escrow
    await dcaFinalizeNewVault(tx, {
      inputType,
      outputType,
      escrow,
      receipt,
      coinY: coinY as TransactionObjectArgument,
    });
    const result = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: senderAddress,
    });

    if (result.effects.status.status == "success") {
      let resp = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: { showObjectChanges: true }, // decrease latency, we only receive objectChanges events
      });

      const objectChanges = resp.objectChanges;

      if (resp.objectChanges) {
        for (const event of resp.objectChanges) {
          if (
            event.type === "created" &&
            event.objectType.startsWith(
              `${process.env.DCA_PACKAGE!}::dca::Escrow`,
            )
          ) {
            // DB update
            const response = await this.client.getObject({
              id: event.objectId,
              options: { showContent: true, showType: true, showOwner: true },
            });
            const escrow = suiObjectToEscrow(response);
            if (escrow !== null) {
              const value = escrowToDatabaseValue(escrow);
              if (Object.keys(this.escrows).includes(escrow.id)) {
                // update
                await this.db
                  .update(schema.escrows)
                  .set(value)
                  .where(eq(schema.escrows.objectID, escrow.id));
                logger.info({ escrow }, "update escrow");
              } else {
                // insert
                await this.db.insert(schema.escrows).values(value);
                logger.info({ escrow }, "add escrow");
              }
            } else {
              logger.warn(
                "fail to compile Escrow Object from response: ",
                response,
              );
            }
          }
        }
      }
    } else {
      console.log("error", result);
      logger.error({ tx }, "tx fail");
    }
  }
  async moveCallExectueOrder(
    escrowId: string,
    inputType: COIN,
    outputType: COIN,
    closed = false,
  ) {
    await this.loadDatabase();

    logger.info("executing order");

    const senderAddress = this.keypair.toSuiAddress();
    let tx = new TransactionBlock();

    const escrow = this.escrows[escrowId];

    if (!escrow) {
      logger.warn("Unexisted Escrow for Id: ", escrowId);
      return;
    }

    this.bucketClient.updateSupraOracle(tx as any, inputType);
    this.bucketClient.updateSupraOracle(tx as any, outputType);

    const [coinX, receipt] = dcaExecuteOrder(tx, {
      inputType,
      outputType,
      escrow,
    });
    let coinY = await aftermathSwapByInput(tx, {
      senderAddress,
      coinInSymbol: inputType,
      coinOutSymbol: outputType,
      coinInAmount: BigInt(escrow.divided_amount),
      coinIn: coinX,
      slippage: 1,
    });
    if (!coinY) return undefined;
    dcaRepayOrder(tx, {
      inputType,
      outputType,
      escrow,
      receipt,
      coinY: coinY as TransactionObjectArgument,
    });

    if (closed) {
      logger.info("closing order");
      const [coinX, coinY] = dcaCloseVault(tx, {
        inputType,
        outputType,
        escrow,
      });
      tx.transferObjects(
        [coinX, coinY],
        tx.pure(this.keypair.toSuiAddress(), "address"),
      );
    }
    const result = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: senderAddress,
    });

    if (result.effects.status.status == "success") {
      let resp = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        options: {
          showObjectChanges: true,
          showEffects: true,
        },
      });
      if (closed) {
        // delete from DB
        await this.db
          .delete(schema.escrows)
          .where(eq(schema.escrows.objectID, escrowId));
        logger.info({ escrow }, `orderClosed: ${escrowId}`);
      } else {
        if (resp.objectChanges) {
          for (const event of resp.objectChanges) {
            if (
              event.type === "mutated" &&
              event.objectType.startsWith(
                `${process.env.DCA_PACKAGE!}::dca::Escrow`,
              )
            ) {
              const response = await this.client.getObject({
                id: event.objectId,
                options: { showContent: true, showType: true, showOwner: true },
              });
              console.log("response", response);
              const escrow = suiObjectToEscrow(response);

              if (escrow === null) {
                logger.warn(
                  "fail to compile Escrow Object from response: ",
                  response,
                );
                return;
              }
              const value = escrowToDatabaseValue(escrow);
              await this.db
                .update(schema.escrows)
                .set(value)
                .where(eq(schema.escrows.objectID, escrow.id));
              logger.info({ escrow }, "inserted escrow");
            }
          }
        }
      }
    } else {
      // Error handling
      logger.error({ result }, "tx fail");
      tx.blockData.transactions.forEach((tx, id) => console.log(id, tx));
      if (result.effects.status.error) {
        const [functionName, errorCode] = extractErrorMessage(
          result.effects.status.error,
        );
        if (
          (functionName === "repay_order" && errorCode === 101) || // slippage
          (functionName === "execute_order" && errorCode === 104) || // already claimed
          (functionName === "execute_order" && errorCode === 110) || // orders all filled
          (functionName === "execute_order" && errorCode === 112) // empty deposit
        ) {
          // catch SLIPPAGE error
          // record execution time
          if (escrow.executed_time < new Date().getTime() / 1000) {
            const value = escrowToDatabaseValue(escrow);
            const executedTime = getEpochTime(escrow) + escrow.frequency;
            logger.info({ ...value, executedTime }, "value_");
            await this.db
              .update(schema.escrows)
              .set({ ...value, executedTime })
              .where(eq(schema.escrows.objectID, escrow.id));
          }
        }
      }
    }

    //remove from loading tx
    if (this.executingOrders.includes(escrow.id)) {
      this.executingOrders.splice(this.executingOrders.indexOf(escrow.id), 1);
      logger.info("delete");
    }
  }

  async moveCallCloseEscrow(
    escrowId: string,
    inputType: COIN,
    outputType: COIN,
  ) {
    await this.loadDatabase();
    logger.info(`closing the escrow: ${escrowId}`);

    const senderAddress = this.keypair.toSuiAddress();
    let tx = new TransactionBlock();
    tx.setSender(this.keypair.toSuiAddress());
    const escrow = this.escrows[escrowId];

    if (!escrow) {
      logger.warn("Unexisted Escrow for Id: ", escrowId);
      return;
    }

    const [coinX, coinY] = dcaCloseVault(tx, { inputType, outputType, escrow });
    tx.transferObjects(
      [coinX, coinY],
      tx.pure(this.keypair.toSuiAddress(), "address"),
    );

    const result = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: senderAddress,
    });

    if (result.effects.status.status == "success") {
      let resp = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        signer: this.keypair,
        requestType: "WaitForLocalExecution",
        options: { showEffects: true },
      });
      if (resp.effects?.status.status === "success") {
        // delete from DB
        await this.db
          .delete(schema.escrows)
          .where(eq(schema.escrows.objectID, escrowId));
        logger.info({ escrow }, `orderClosed: ${escrowId}`);
      }
    } else {
      logger.error({ result }, "tx fail");
    }
    if (this.executingOrders.includes(escrowId))
      this.executingOrders.splice(this.executingOrders.indexOf(escrowId), 1);
  }
}
