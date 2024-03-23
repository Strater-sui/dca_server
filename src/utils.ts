import { TransactionObjectArgument } from "@mysten/sui.js/transactions";
import { Escrow } from "./type.d";

export const FLOAT_SCALING = 10 ** 9;
// Type Guard
export function isEscrow(
  escrow: TransactionObjectArgument | Escrow,
): escrow is Escrow {
  return (
    (<Escrow>escrow).typeX !== undefined && (<Escrow>escrow).typeY !== undefined
  );
}

import { BCS, getSuiMoveConfig } from "@mysten/bcs";
import { DECIMAL_PLACES } from "./constants";
export const bcs_ = new BCS(getSuiMoveConfig());

export const bcs = bcs_
  .registerAlias("0x2::object::ID", BCS.ADDRESS)
  .registerEnumType("Option<T>", {
    none: null,
    some: "T",
  })
  .registerStructType("0x2::table::Table", {
    id: "address",
    size: "u64",
  })
  .registerStructType(["0x2::vec_map::Entry", "K", "V"], {
    key: "K",
    value: "V",
  })
  .registerStructType(["0x2::vec_map::VecMap", "K", "V"], {
    length: BCS.U8,
    contents: ["0x2::vec_map::Entry", "K", "V"],
  })
  .registerStructType(["Balance", "T"], {
    value: BCS.U64,
  });

export function extractGenericType(type: string): string {
  const regex = /<([^>]+)>/;

  const match = type.match(regex);

  return match ? match[1] : "";
}

export function extractErrorMessage(error: string) {
  const functionNameMatch = error.match(/function_name: Some\("([^"]+)"\)/);
  const errorCodeMatch = error.match(/MoveAbort.*\{.*, (\d+)\)/);

  const functionName = functionNameMatch ? functionNameMatch[1] : null;
  const errorCode = errorCodeMatch ? parseInt(errorCodeMatch[1]) : null;

  return [functionName, errorCode];
}

export function floatBitIntToNumber(value: bigint, decimals = DECIMAL_PLACES) {
  return (
    Number((value * BigInt(10 ** decimals)) / BigInt(FLOAT_SCALING)) /
    10 ** decimals
  );
}
