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
 * @author Publius, Brean
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

    /**
     * @dev Sets the twaReserves.
     * assumes the twaReserve indexes correspond to the metapool indexes.
     */
    function setTwaReservesForPool(address pool, uint256[2] memory twaReserves) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.twaReserves[pool].reserve0 = twaReserves[0].toUint128();
        s.twaReserves[pool].reserve1 = twaReserves[1].toUint128();
    }

    /**
     * @notice Returns the twa reserves.
     */
    function getTwaReservesForPool(
        address pool
    ) internal view returns (uint256[2] memory twaReserves) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        twaReserves[0] = s.twaReserves[pool].reserve0;
        twaReserves[1] = s.twaReserves[pool].reserve1;
    }

    /**
     * @notice resets token price for a well to 1.
     * @dev must be called at the end of sunrise().
     */
    function resetTwaReservesForPool(address pool) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.twaReserves[pool].reserve0 = 1;
        s.twaReserves[pool].reserve1 = 1;
    }

    
    /**
     * @notice gets the reserves depending on the pool:
     * if the reserves are set, use those values.
     * if they are not set, and it is the bean3crv pool,
     * use the value from {LibCurveMinting.twaBalances()}.
     * else (a factory metapool), use the previous balances.
     */
    function getReservesFromStorageOrTwaOrPrevBalances(
        address pool
    ) internal view returns (uint256[2] memory twaReserves) {
        twaReserves = getTwaReservesForPool(pool);
        if (twaReserves[0] == 1) {
            if (pool == C.CURVE_BEAN_METAPOOL){
                (twaReserves, ) = LibCurveMinting.twaBalances();
            } else {
                twaReserves = IMeta3Curve(pool).get_previous_balances();
            }
        }
    }
}
