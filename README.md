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
yarn script --action execute --escrowId 0xce4375adc878786f5fff010968e6278b7329556b961d05f6293c45acb18a8f69

# Cancel Order
yarn script --action close --escrowId 0xaa75d8bef4872334a4fea47bf9963524657c0078d5fecf896bfdc26eefe67f55