# dca_server

Db migration & updates:
```bash
npx prisma generate
npx prisma db push
```

To install dependencies:

```bash
yarn install
```

To run:

```bash
yarn fallback
```

```bash
yarn start
```

## Scripts for test actions

# Place Order
yarn script --action place --input USDC --output SUI --amount 0.01 --orders 2 --frequency 60

# Execute Order
yarn script --action execute --escrowId 0x532780e00d463898329a4d8f39c534631eb6614f28dfd9e11a286b709e6bd061

# Cancel Order
yarn script --action close --escrowId 0x532780e00d463898329a4d8f39c534631eb6614f28dfd9e11a286b709e6bd061