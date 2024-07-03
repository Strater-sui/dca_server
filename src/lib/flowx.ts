import { CLOCK_OBJECT } from "bucket-protocol-sdk";

import type {
  Transaction,
  TransactionArgument,
  TransactionResult,
} from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import {
  AggregatorQuoter,
  Coin,
  Route,
  TradeBuilder,
} from "@flowx-finance/sdk";
import { SuiClient } from "@mysten/sui/client";

const quoter = new AggregatorQuoter("mainnet");

export async function simulateFlowxGivenAmountIn(
  coinInType: string,
  coinOutType: string,
  amountIn: bigint,
) {
  return await quoter.getRoutes({
    tokenIn: coinInType,
    tokenOut: coinOutType,
    amountIn: amountIn.toString(),
  });
}

export async function executeFlowxSwap(
  tx: Transaction,
  client: SuiClient,
  inputs: {
    routes: Route<Coin, Coin>[];
    coinIn: TransactionArgument;
    slippage: number;
  },
): Promise<TransactionResult> {
  const tradeBuilder = new TradeBuilder("mainnet", inputs.routes);
  const coinOut = await tradeBuilder
    .slippage(inputs.slippage)
    .build()
    .swap({
      client: client as any,
      tx: tx as any,
      coinIn: inputs.coinIn as any,
    });

  if (!coinOut) throw new Error("fail to build the tx from FlowX router");

  return coinOut;
}

export async function flowXSwapByInput(
  tx: Transaction,
  client: SuiClient,
  inputs: {
    coinInType: string;
    coinOutType: string;
    amountIn: bigint;
    coinIn: TransactionArgument;
  },
): Promise<TransactionResult> {
  const query = await simulateFlowxGivenAmountIn(
    inputs.coinInType,
    inputs.coinOutType,
    inputs.amountIn,
  );
  const slippage = (0.5 / 100) * 1e6; // 0.5%
  return await executeFlowxSwap(tx, client, {
    routes: query.routes,
    slippage,
    coinIn: inputs.coinIn,
  });
}
