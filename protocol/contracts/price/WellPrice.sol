// //SPDX-License-Identifier: MIT
// pragma solidity =0.7.6;
// pragma experimental ABIEncoderV2;

// import {P, IBDV} from "./P.sol";
// import "../libraries/Well/LibWellStorage.sol";
// import "../libraries/Well/Type/LibConstantProductWell.sol";
// import "../interfaces/IChainlinkOracle.sol";
// import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// interface IWell {
//     function getWellAtIndex(uint256 index)
//         external
//         view
//         returns (
//             LibWellStorage.WellInfo memory info,
//             LibWellStorage.Balances memory state,
//             uint256 wellTokenSupply
//         );
// }

// contract WellPrice {

//     using SafeMath for uint256;

//     address private constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
//     address private constant ETH_USD_CHAINLINK_ORACLE = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

//     function getWell() public view returns (P.Pool memory pool) {
//         (
//             LibWellStorage.WellInfo memory info,
//             LibWellStorage.Balances memory balances,
//             uint256 wellTokenSupply
//         ) = IWell(BEANSTALK).getWellAtIndex(0);
//         pool.pool = info.wellId;
//         pool.tokens[0] = address(info.tokens[0]);
//         pool.tokens[1] = address(info.tokens[1]);
//         pool.balances[0] = balances.balances[0];
//         pool.balances[1] = balances.balances[1];

//         (, int256 answer, , , ) = IChainlinkOracle(ETH_USD_CHAINLINK_ORACLE).latestRoundData();

//         uint256 ethPrice = uint256(answer).mul(1e10);

//         pool.price = uint256(balances.balances[0]).mul(1e36).div(balances.balances[1]).div(ethPrice);
//         pool.liquidity = uint256(balances.balances[1]).mul(2).mul(ethPrice).div(1e30);
//         pool.deltaB = 0; //LibConstantProductWell.deltaX(ethPrice, balances.balances, 0, 1);
//         pool.lpSupply = wellTokenSupply;
//         pool.lpUsd = pool.liquidity * 1e18 / wellTokenSupply;
//         pool.lpBdv = IBDV(BEANSTALK).bdv(info.wellId, 1e18);
//     }
// }
