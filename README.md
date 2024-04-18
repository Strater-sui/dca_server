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
yarn script --action place --input USDC --output SUI --amount 0.1 --orders 2 --frequency 30

# Execute Order
yarn script --action execute --escrowId 0x532780e00d463898329a4d8f39c534631eb6614f28dfd9e11a286b709e6bd061

# Cancel Order
yarn script --action close --escrowId 0x532780e00d463898329a4d8f39c534631eb6614f28dfd9e11a286b709e6bd061


yarn script --action transfer --objectId 0xe3f6f77c32e2ec27670c1a6c282b8a6b0a7ebc56057077c9467c4383cb7c0b6f --recipient 0xc89a45596cc8029c5d1a4fa74d0bf8ddb806d40070c8fc45469bd8f9a9cca701