// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, LibAppStorage, Storage} from "../LibAppStorage.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibCurve} from "./LibCurve.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import "../../C.sol";

/**
 * @dev Curve Metapool extended interface.
 */
interface IMeta3Curve {
    function A_precise() external view returns (uint256);
    function get_previous_balances() external view returns (uint256[2] memory);
    function get_virtual_price() external view returns (uint256);
}

/**
 * @title LibMetaCurve
 * @author Publius
 * @notice Wraps {LibCurve} with metadata about Curve Metapools, including the
 * `A` parameter and virtual price. Additionally hosts logic regarding setting
 * retrieving, and resetting the bean3crv twa reserves.
 */
library LibMetaCurve {
    using SafeMath for uint256;
    using SafeCast for uint256;
    
    /**
     * @dev Used in {LibBeanMetaCurve}.
     */
    function getXP(
        uint256[2] memory balances,
        uint256 padding
    ) internal view returns (uint256[2] memory) {
        return LibCurve.getXP(
            balances,
            padding,
            C.curve3Pool().get_virtual_price()
        );
    }

    /**
     * @dev Used in {LibBeanMetaCurve}.
     */
    function getDFroms(
        address pool,
        uint256[2] memory balances,
        uint256 padding
    ) internal view returns (uint256) {
        return LibCurve.getD(
            getXP(balances, padding),
            IMeta3Curve(pool).A_precise()
        );
    }

}
