export type MoveCallTarget = `${string}::${string}::${string}`;
export type Escrow = {
  id: string;
  initial_shared_version: number;
  typeX: string;
  typeY: string;
  owner: string;
  frequency: number;
  divided_amount: number;
  last_claimed: number;
  filled_orders: number;
  balance_x: number;
  balance_y: number;
  decimals_x: number;
  decimals_y: number;
  price_enabled: boolean;
  min_price: number;
  max_price: number;
  deposit_time: number;
  end_time: number;
  total_spent: number;
  total_withdrawn_amount: number;
  executed_time: number;
  tank_dca?: TankDCA;
};

export type TankDCA = {
  staked_buck: number;
  rewarded_collateral: number;
  rewarded_bkt: number;
};
