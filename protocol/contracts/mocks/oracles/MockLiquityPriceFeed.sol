/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/ILiquityPriceFeed.sol";
import "../../interfaces/IChainlinkOracle.sol";

/**
 * @author Publius
 * @title MockSiloToken is a mintable ERC-20 Token.
**/
contract MockLiquityPriceFeed is ILiquityPriceFeed {

    address constant CHAINLINK_ORACLE = address(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    function fetchPrice() external override returns (uint answer) {
        int256 sAnswer;
        (, sAnswer, , , ) = IChainlinkOracle(CHAINLINK_ORACLE).latestRoundData();
        answer = uint256(sAnswer) * 1e10;
    }

}
