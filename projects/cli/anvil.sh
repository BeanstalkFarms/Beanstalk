#!/bin/bash

source .env

# Set variables based on arguments
keyType="$1"
chainIdType="$2"

# Set chain IDs
mainnet_local_chain_id=1337
arbitrum_local_chain_id=41337

# Determine which API key to use
if [ "$keyType" = "test" ]; then
    apiKey="$DEV_TEST_ALCHEMY_API_KEY"
else
    apiKey="$DEV_ALCHEMY_API_KEY"
fi

# Determine which chain ID to use. Defaults to arbitrum local host
if [ "$chainIdType" = "mainnet-local" ]; then
    chainId=$mainnet_local_chain_id
    prefix="eth"
    port=9545
else
    chainId=$arbitrum_local_chain_id
    prefix="arb"
    port=8545
fi

# Check if required variables are set
if [ -z "$prefix" ] || [ -z "$apiKey" ] || [ -z "$chainId" ]; then
  echo "Error: Missing required variables. Please set keyType and chainIdType."
  exit 1
fi

anvil \
  --fork-url "https://$prefix-mainnet.g.alchemy.com/v2/$apiKey" \
  --chain-id "$chainId" \
  --port "$port" \
  "${@:3}"

# Check if Anvil exited with an error
if [ $? -ne 0 ]; then
  echo "Error: Anvil exited with a non-zero status."
  exit 1
fi