[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

[proj-protocol]: /protocol
[proj-sdk]: /projects/sdk
[proj-ui]: /projects/ui
[proj-subgraph-beanstalk]: /projects/subgraph-beanstalk
[proj-subgraph-bean]: /projects/subgraph-bean
[proj-cli]: /projects/cli
[es-beanstalk]: https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5
[es-bean]: https://etherscan.io/address/0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab

<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

# Beanstalk

[![Discord][discord-badge]][discord-url]

Code Version: `2.3.1` <br>
Whitepaper Version: `2.3.0`

## About

Beanstalk is a permissionless fiat stablecoin protocol built on Ethereum.

- [Repository](#repository)
- [Documentation](#documentation)
- [Audits](#audits)
- [Bug Bounty Program](#bug-bounty-program)
- [Contracts](#contracts)
- [License](#license)

## Repository

| Project                                         | Description                                                                          |
|-------------------------------------------------|--------------------------------------------------------------------------------------|
| [`protocol`][proj-protocol]                     | The Beanstalk protocol, its facets and related contracts in the Beanstalk ecosystem. |
| [`subgraph-beanstalk`][proj-subgraph-beanstalk] | A subgraph indexing Beanstalk ([0xC1E088][es-beanstalk]).                            |
| [`subgraph-bean`][proj-subgraph-bean]           | A subgraph indexing the Bean ERC-20 token ([0xBEA000][es-bean]).                     |
| [`sdk`][proj-sdk]                               | A Typescript SDK for interacting with Beanstalk and ecosystem contracts.             |
| [`ui`][proj-ui]                                 | The Beanstalk UI hosted at [app.bean.money](https://app.bean.money).                 |
| [`cli`][proj-cli]                               | A tool for interacting with Beanstalk in a development environment.                  |

## Development
If you are a developer and would like to contribute, please see our [DEVELOPER.md](./DEVELOPER.md) document for how to get started.

## Documentation

Conceptual documentation on Beanstalk can be found in the [Farmers' Almanac](https://docs.bean.money/almanac). <br>
Technical documentation on Beanstalk can be found in the [Agronomics Handbook](https://docs.bean.money/developers).

The latest version of the Beanstalk Whitepaper is available [here](https://bean.money/beanstalk.pdf) (version history can be found [here](https://github.com/BeanstalkFarms/Beanstalk-Whitepaper/tree/main/version-history)).

## Audits

Read more about Beanstalk audits [here](https://docs.bean.money/almanac/protocol/audits).

## Bug Bounty Program

The Beanstalk DAO partnered with Immunefi to launch a bug bounty program with rewards up to **1.1M Beans**.

You can find the bug bounty program and submit bug reports [here](https://immunefi.com/bounty/beanstalk).

## Contracts

A comprehensive list of contract addresses related to Beanstalk is available [here](https://docs.bean.money/almanac/protocol/contracts).

|       Contract               |              Address 
|:-----------------------------|:-----------------------------------------------------------------------------------------------------------------------|
|  Beanstalk                   | [0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5][es-beanstalk]  |
|  Bean                        | [0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab][es-bean]  |
|  BEAN:3CRV LP token          | [0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49](https://etherscan.io/address/0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49)  |
|  Unripe Bean token           | [0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449](https://etherscan.io/address/0x1BEA0050E63e05FBb5D8BA2f10cf5800B6224449)  |
|  Unripe BEAN:3CRV LP token   | [0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D](https://etherscan.io/address/0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D)  |
|  Fertilizer ERC-1155 token   | [0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6](https://etherscan.io/address/0x402c84de2ce49af88f5e2ef3710ff89bfed36cb6)  |
| Beanstalk Community Multisig | [0xa9bA2C40b263843C04d344727b954A545c81D043](https://etherscan.io/address/0xa9bA2C40b263843C04d344727b954A545c81D043)  |


## License

[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE.txt)
