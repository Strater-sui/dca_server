import {
  Ed25519Keypair,
} from "@mysten/sui.js/keypairs/ed25519";
import yargs from 'yargs';
import { closeOrder, executeOrder, placeOrder, transfer } from "./transactions";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { COIN, COINS_TYPE_LIST } from "bucket-protocol-sdk";
import { CloseOrderEvent, ErrorCode, EscrowOrderEvent, ExecuteOrderEvent } from "./type";
import { ORDER_CLOSED_EVENT, ORDER_EXECUTED_EVENT, ORDER_CREATED_EVENT } from "./config";
import { updateCloseEvent } from "./model/updateClose";
import { updateExecuteEvent } from "./model/updateExecute";
import { updateEscrowEvent } from "./model/updateEscrow";
import prisma from "./lib/prisma";

(async () => {
  // parse command line arguments
  const params = yargs(process.argv.slice(2))
    .options('action', {
      choices: ["place", "execute", "close", "transfer"],
      demandOption: true,
    })
    .string("recipient")
    .string("objectId")
    .string("escrowId")
    .string("input")
    .string("output")
    .number("amount")
    .number("orders")
    .number("frequency")
    .parseSync();

  const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
  const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);

  try {
    switch (params.action) {
      case "place":
        {
          let { input, output, amount, frequency, orders } = params;
          if (!input || !output || !amount || !frequency || !orders) {
            console.log("Required params missing");
            return;
          }

          console.log("Place order...", input, output, amount, frequency, orders);
          const ret = await placeOrder(client, keypair, input as COIN, output as COIN, amount, frequency, orders);
          if (ret && ret.status == ErrorCode.SUCCESS && ret.data) {
            let { events, digest, checkpoint, timestamp } = ret.data;
            let _event = events?.find(t => t.type.startsWith(ORDER_CREATED_EVENT));
            if (_event) {
              let event = _event.parsedJson as EscrowOrderEvent;
              event.input_type = COINS_TYPE_LIST[input as COIN];
              event.output_type = COINS_TYPE_LIST[output as COIN];
              await updateEscrowEvent(prisma, event, digest, Number(checkpoint), timestamp);
            }

          }
          else {
            console.log("Close order failed", ret?.status);
          }
        }
        break;
      case "execute":
        {
          let { escrowId } = params;
          if (!escrowId) {
            console.log("Required params missing");
            return;
          }

          const escrow = await prisma.dca.findFirst({
            where: {
              escrowId
            }
          });
          if (!escrow) {
            console.log("Escrow object not found");
            return;
          }

          console.log("Execute order...", escrowId);
          const ret = await executeOrder(client, keypair, escrow);
          if (ret && ret.status == ErrorCode.SUCCESS && ret.data) {
            let { events, digest, checkpoint, timestamp } = ret.data;
            let _event = events?.find(t => t.type.startsWith(ORDER_EXECUTED_EVENT));
            if (_event) {
              let event = _event.parsedJson as ExecuteOrderEvent;
              await updateExecuteEvent(prisma, event, digest, Number(checkpoint), timestamp);
            }

          }
          else {
            console.log("Execute order failed", ret?.status);
          }
        }
        break;
      case "close":
        {
          let { escrowId } = params;
          if (!escrowId) {
            console.log("Required params missing");
            return;
          }

          const escrow = await prisma.dca.findFirst({
            where: {
              escrowId
            }
          });
          if (!escrow) {
            console.log("Escrow object not found");
            return;
          }

          console.log("Close order...", escrowId);
          const ret = await closeOrder(client, keypair, escrow);
          if (ret && ret.status == ErrorCode.SUCCESS && ret.data) {
            let { events, digest, checkpoint, timestamp } = ret.data;
            let _event = events?.find(t => t.type.startsWith(ORDER_CLOSED_EVENT));
            if (_event) {
              let event = _event.parsedJson as CloseOrderEvent;
              await updateCloseEvent(prisma, event, digest, Number(checkpoint), timestamp);
            }

          }
          else {
            console.log("Close order failed", ret?.status);
          }
        }
        break;
      case "transfer":
        {
          let { recipient, objectId } = params;
          if (!recipient || !objectId) {
            console.log("Required params missing");
            return;
          }

          await transfer(client, keypair, objectId, recipient);
        }
        break;
      default:
        console.log("No valid action specified");
        break;
    }
  } catch (error) {
    console.log(error);
  }
})();
