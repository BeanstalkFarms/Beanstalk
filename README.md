[discord-badge]: https://img.shields.io/discord/880413392916054098?label=Beanstalk
[discord-url]: https://discord.gg/beanstalk

[proj-protocol]: /protocol
[proj-ui]: /projects/ui
[proj-sdk]: /projects/sdk
[proj-subgraph-beanstalk]: /projects/subgraph-beanstalk
[proj-subgraph-bean]: /projects/subgraph-bean
[proj-cli]: /projects/cli
[proj-basin-ui]: /projects/dex-ui
[proj-basin-sdk]: /projects/sdk-wells
[proj-subgraph-basin]: /projects/subgraph-wells

[basin-protocol]: https://github.com/BeanstalkFarms/Basin
[pipeline-protocol]: https://github.com/BeanstalkFarms/Pipeline


[es-beanstalk]: https://etherscan.io/address/0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5
[es-bean]: https://etherscan.io/address/0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab
[es-basin]: https://docs.basin.exchange/resources/contracts

[npm-beanstalk]: https://www.npmjs.com/package/@beanstalk/sdk

<img src="https://github.com/BeanstalkFarms/Beanstalk-Brand-Assets/blob/main/BEAN/bean-128x128.png" alt="Beanstalk logo" align="right" width="120" />

# Beanstalk

[![Discord][discord-badge]][discord-url]

Code Version: `2.7.3` <br>
Whitepaper Version: `2.7.0`

## About

Beanstalk is a permissionless fiat stablecoin protocol built on Ethereum.

- [Repository](#repository)
- [Development](#development)
- [Documentation](#documentation)
- [Governance](#governance)
- [Audits](#audits)
- [Bug Bounty Program](#bug-bounty-program)
- [Contracts](#contracts)
- [License](#license)

## Repository

| Project                                         | Description                                                                                             |
|:------------------------------------------------|:--------------------------------------------------------------------------------------------------------|
| [`protocol`][proj-protocol]                     | The Beanstalk protocol, its facets and related contracts in the Beanstalk ecosystem.                    |
| [`ui`][proj-ui]                                 | The Beanstalk UI hosted at [app.bean.money](https://app.bean.money).                                    |
| [`sdk`][proj-sdk]                               | A Typescript SDK for interacting with Beanstalk and ecosystem contracts ([npm module][npm-beanstalk]).  |
| [`subgraph-beanstalk`][proj-subgraph-beanstalk] | A subgraph indexing Beanstalk ([0xC1E088][es-beanstalk]).                                               |
| [`subgraph-bean`][proj-subgraph-bean]           | A subgraph indexing the Bean ERC-20 token ([0xBEA000][es-bean]).                                        |
| [`cli`][proj-cli]                               | A tool for interacting with Beanstalk in a development environment.                                     |
| [`dex-ui`][proj-basin-ui]                          | The Basin UI hosted at [basin.exchange](https://basin.exchange).                                     |
| [`sdk-wells`][proj-basin-sdk]                   | A Typescript SDK for interacting with Basin its components' contracts.                                  |
| [`subgraph-wells`][proj-subgraph-basin]         | A subgraph indexing Basin and its components.                                                           |

Note that the [Basin][basin-protocol] and [Pipeline][pipeline-protocol] contracts are in separate repostitories.

## Development

If you are a developer and would like to contribute, please see our [DEVELOPER.md](./DEVELOPER.md) document for how to get started.

## Documentation

Conceptual documentation on Beanstalk can be found in the [Farmers' Almanac](https://docs.bean.money/almanac). <br>
Technical documentation on Beanstalk can be found in the [Agronomics Handbook](https://docs.bean.money/developers).

The latest version of the Beanstalk Whitepaper is available [here](https://bean.money/beanstalk.pdf) (version history can be found [here](https://github.com/BeanstalkFarms/Beanstalk-Whitepaper/tree/main/version-history)).

## Governance

Read more about Beanstalk governance [here](https://docs.bean.money/almanac/governance/beanstalk). All past governance proposals can be found [here](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals).

## Audits

Read more about Beanstalk audits [here](https://docs.bean.money/almanac/protocol/audits).

## Bug Bounty Program

The Beanstalk DAO partnered with Immunefi to launch a bug bounty program with rewards up to **1.1M Beans**.

You can find the bug bounty program and submit bug reports [here](https://immunefi.com/bounty/beanstalk).

## Contracts

A comprehensive list of contract addresses related to Beanstalk is available [here](https://docs.bean.money/almanac/protocol/contracts).

## License

[MIT](https://github.com/BeanstalkFarms/Beanstalk/blob/master/LICENSE.txt)
