const DCA_PACKAGE = process.env.DCA_PACKAGE!;
import { COIN, COINS_TYPE_LIST } from "bucket-protocol-sdk";
import { MoveCallTarget } from "./type";

export const DCA_CONFIG = {
  PACKAGE_ID: DCA_PACKAGE,
  DCA_REG: {
    objectId:
      "0xb46f596bdbf63424e1208ccb6adaa3049fed8da305a87cbf3b8a16c4763352fc",
    initialSharedVersion: 79202161,
    mutable: true,
  },
  targets: {
    placeOrder: `${DCA_PACKAGE}::dca::place_order` as MoveCallTarget,
    finalizeNewVault:
      `${DCA_PACKAGE}::dca::finalize_new_vault` as MoveCallTarget,
    executeOrder: `${DCA_PACKAGE}::dca::execute_order` as MoveCallTarget,
    closeVault: `${DCA_PACKAGE}::dca::close_vault` as MoveCallTarget,
    repayOrder: `${DCA_PACKAGE}::dca::repay_order` as MoveCallTarget,
    updatePrice: `${DCA_PACKAGE}::dca::update_price` as MoveCallTarget,
    getEscrowRequiredAmount:
      `${DCA_PACKAGE}::dca::get_escrow_required_amount` as MoveCallTarget,
    getOutputX: `${DCA_PACKAGE}::dca::get_output_x` as MoveCallTarget,
    getOutputY: `${DCA_PACKAGE}::dca::get_output_y` as MoveCallTarget,
    totalVaults: `${DCA_PACKAGE}::dca::total_vaults` as MoveCallTarget,
  },
};

export const DCA_BUCKET_CONFIG = {
  targets: {
    stakeTank: `${DCA_PACKAGE}::dca_bucket::stake_tank` as MoveCallTarget,
    unstakeTank: `${DCA_PACKAGE}::dca_bucket::unstake_tank` as MoveCallTarget,
    executeOrder: `${DCA_PACKAGE}::dca_bucket::execute_order` as MoveCallTarget,
    repayOrderInBuck:
      `${DCA_PACKAGE}::dca_bucket::repay_order_in_buck` as MoveCallTarget,
    repayOrderInCollateral:
      `${DCA_PACKAGE}::dca_bucket::repay_order_in_collateral` as MoveCallTarget,
    getEscrowRequiredAmount:
      `${DCA_PACKAGE}::dca_bucket::get_escrow_required_amount` as MoveCallTarget,
  },
};

export const COIN_METADATA: Record<string, string> = {
  SUI: "0x9258181f5ceac8dbffb7030890243caed69a9599d2886d957a9cb7656af3bdb3",
  USDC: "0x4fbf84f3029bd0c0b77164b587963be957f853eccf834a67bb9ecba6ec80f189",
  USDT: "0xfb0e3eb97dd158a5ae979dddfa24348063843c5b20eb8381dd5fa7c93699e45c",
  USDY: "0xd8dd6cf839e2367de6e6107da4b4361f44798dd6cf26d094058d94e4cee25e36",
  BUCK: "0x0db5e20f3fc2b12e294e5474babbec1c2efd96f21663accfbcb25da99a48838a",
};

export const COIN_SYMBOLS: Record<string, COIN> = {};
Object.entries(COINS_TYPE_LIST).forEach(([coin, id]) => {
  COIN_SYMBOLS[id] = coin as COIN;
});
COIN_SYMBOLS[
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
] = "SUI";
