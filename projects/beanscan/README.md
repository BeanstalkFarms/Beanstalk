# beanstalk-dashboard

## Setup
Create a new file `.env.local` and configure with your desired chain / RPC URL:
```
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_RPC_WS_URL=ws://localhost:8545 # if your local RPC supports websockets (hardhat and anvil do)
```
```
yarn install
yarn generate
yarn dev --port 4000  # port is optional; prevents clash with Beanstalk-UI on port 3000 if running
```

## Tracking events
Head to the `/events` page and click "Start listening" in the top right.