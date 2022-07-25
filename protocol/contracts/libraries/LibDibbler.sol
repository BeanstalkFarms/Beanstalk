/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./LibAppStorage.sol";
import "./LibSafeMath32.sol";

/**
 * @author Publius
 * @title Dibbler
 **/
library LibDibbler {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

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
        s.f.soil = s.f.soil - amount;
        return sowNoSoil(amount, account);
    }

    function sowNoSoil(uint256 amount, address account)
        internal
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 pods = beansToPods(amount, s.w.yield);
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

    function beansToPods(uint256 beans, uint256 weather)
        private
        pure
        returns (uint256)
    {
        return beans.add(beans.mul(weather).div(100));
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.f.soil > 1e6 || s.w.nextSowTime < type(uint32).max) return;
        s.w.nextSowTime = uint32(block.timestamp.sub(s.season.timestamp));
    }
}
