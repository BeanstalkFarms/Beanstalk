/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IInstantaneousPump} from "@wells/interfaces/pumps/IInstantaneousPump.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Call, IWell} from "@wells/interfaces/IWell.sol";
import {IWellFunction} from "@wells/interfaces/IWellFunction.sol";
import {C} from "~/C.sol";
import {AppStorage, LibAppStorage} from "../LibAppStorage.sol";
import {LibUsdOracle} from "~/libraries/Oracle/LibUsdOracle.sol";

/**=
 * @title LibWellPrice handles fetching the price of ERC-20 tokens in a Well.
 **/

library LibWell {

    function getRatiosAndBeanIndex(IERC20[] memory tokens) internal view returns (
        uint[] memory ratios,
        uint beanIndex
    ) {
        ratios = new uint[](tokens.length);
        for (uint i; i < tokens.length; ++i) {
            if (C.beanAddress() == address(tokens[i])) {
                beanIndex = i;
                ratios[i] = 1e6;
            } else {
                ratios[i] = LibUsdOracle.getUsdPrice(address(tokens[i]));
            }
        }
    }
    
    function getBeanIndex(IERC20[] memory tokens) internal pure returns (uint beanIndex) {
        for (beanIndex; beanIndex < tokens.length; ++beanIndex) {
            if (C.beanAddress() == address(tokens[beanIndex])) {
                return beanIndex;
            }
        }
    }

    function getBeanIndexFromWell(address well) internal view returns (uint beanIndex) {
        IERC20[] memory tokens = IWell(well).tokens();
        beanIndex = getBeanIndex(tokens);
    }

    function isWell(
        address well
    ) internal view returns (bool _isWell) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.ss[well].selector == 0xc84c7727;
    }
}
