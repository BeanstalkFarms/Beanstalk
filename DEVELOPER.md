# Developing Beanstalk

Development happens locally against a local forked version of the blockchain. We do not use testnets.

# Getting Started

## Prerequistes

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
  - You'll know you did it right if you can run `git --version` and you see a response like `git version x.x.x`
- [Nodejs](https://nodejs.org/en/)
  - You'll know you've installed nodejs right if you can run `node --version`and get an ouput like: `vx.x.x`
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/)
  - You'll know you've installed yarn right if you can run `yarn --version` And get an output like: `x.x.x`

## Installation

1. Clone the repo & install dependencies

```bash
git clone https://github.com/BeanstalkFarms/Beanstalk
cd Beanstalk
yarn
```

2. Install [pre-commit git hooks](https://typicode.github.io/husky/) and setup your [workspace](https://classic.yarnpkg.com/lang/en/docs/workspaces/)

```bash
yarn bootstrap
```

## Quickstart

There are cross-project dependencies you may need to be aware of. For ex, the UI uses the SDK, which uses the SDK-Core. The dependencies need to be built before they can be used by the parent project. When you ran `yarn bootstrap`, this built everything for you, but there may be times when you need to do this manually.

Easiest way to ensure everything is built:

```
cd {REPO_ROOT}
yarn
```

This will start building all the dependencies in reverse order. See below to work with different projects.

### Protocol / Contracts

If you're not working on the contracts, you don't need to do anything with the protocol. If you're using anvil ([see here](#anvil-forking-mainnet-locally)), it will use a copy of mainnet, including all the deployed contracts.

If you are developing contracts, see the `README.md` in `/protocol` for more details getting set up.

### Anvil: Forking Mainnet Locally

We elect to use `anvil` instead of `hardhat` for local node forking as `anvil` is considerably faster than `hardhat` and properly caches the blockchain locally.

- Install Foundry with `curl -L https://foundry.paradigm.xyz | bash` and reopen your terminal
- Run `foundryup` to ensure you have downloaded the latest version
- Start a locally forked node with the following command:

```bash
# optionally add
# --fork-block-number <BLOCK_NUMBER>
# if you want a specific point in time

anvil --fork-url <FORK_RPC>  --chain-id 1337 --block-time 12

```

### Anvil Accounts

When anvil starts, you will see a list of Available Accounts and their Private Keys. We recommend using Account #0 (`0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`) and adding its private key to metamtask. (The `bean` cli defaults to this address).

### Bean CLI

In this repo there is also our Beanstalk development CLI tool. To run:

```
# no install, from anywhere inside the monorepo:
yarn g:bean --help

# OR.. installed on your system
npm i -g @beanstalk/cli
bean --help
```

Some examples of what you can do with the bean cli:

- Get balances:`yarn g:bean balance`
- Give yourself 50K of each token: `yarn g:bean setbalance`
- Set balance of a specific token: `yarn g:bean setbalance -t BEAN -m 3000`
- Make BEAN price above $1: `yarn g:bean setprice 20 30`
- Fast forward season into future: `yarn g:bean sunrise --force`

`yarn g:bean --help` for all options

By combining these commands, you should be able to put a beanstalk account in pretty much any state desired.

### Subgraphs

You don't need to run the subgraphs locally unless you're working on those components. If you are using Anvil with the local subgraph node, include the `--disable-block-gas-limit` option when starting Anvil to avoid issues when indexing.

### UI

Start the UI with `yarn ui:start`