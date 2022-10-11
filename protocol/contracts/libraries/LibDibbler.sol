/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";
import "./LibSafeMath128.sol";
import "./LibPRBMath.sol";


/**
 * @author Publius
 * @title Dibbler
 **/
library LibDibbler {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    uint256 private constant A = 2;
    uint256 private constant BLOCK_ELAPSED_MAX = 25;
    uint256 private constant DENOMINATOR = 5672425341971495578; //LibPRBMath.logBase2(A.mul(BLOCK_ELAPSED_MAX.mul(LibPRBMath.LOG_SCALE)).add(LibPRBMath.LOG_SCALE));
    uint256 private constant SCALE = 1e18;
    uint256 private constant DECIMALS = 1e6;


    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    /**
     * Shed
     **/
    function sow(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // We can assume amount <= soil from getSowAmount

        // the amount of soil changes as a function of the morning auction;
        // instead of updating soil, we scale down how much soil is used, and scale soil up in view function
        if (s.season.AbovePeg) {
            uint128 maxYield = uint128(s.w.yield).add(100).mul(uint128(DECIMALS));
            s.f.soil =
                s.f.soil - // safeMath not needed, as morningAuction() will never be higher than s.w.yield
                uint128(amount.mulDiv(morningAuction().add(100 * DECIMALS),maxYield,LibPRBMath.Rounding.Up));

        } else {
            s.f.soil = s.f.soil - uint128(amount);
        }
        return sowNoSoil(amount, account);
    }

    function sowNoSoil(uint256 amount, address account)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 pods = beansToPods(amount);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function sowPlot(
        address account,
        uint256 beans,
        uint256 pods
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    function beansToPods(uint256 beans) private view returns (uint256) {
        return beans.add(beans.mulDiv(morningAuction(),100 * DECIMALS));
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }

    //this function returns the weather scaled down based on the dutch auction
    //has precision level 1e6, as soil has 1e6 precision
    function morningAuction() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 delta = block.number.sub(s.season.sunriseBlock);
        if (delta == 0) {
            return DECIMALS;
        } else if (delta < 25) {
            uint256 x = LibPRBMath.logBase2(
                A.mul(delta.mul(SCALE)).add(SCALE)
            );
            return uint256(s.w.yield).mul(DECIMALS).mulDiv(x,DENOMINATOR).max(DECIMALS); //minimium of 1% yield
        } else {
            return uint256(s.w.yield).mul(DECIMALS);
        }
    }
}
