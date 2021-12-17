/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../interfaces/IBean.sol";
import "./Dibbler.sol";

/**
 * @author Publius
 * @title Dibbler
**/
contract BeanDibbler is Dibbler {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    uint32 private constant MAX_UINT32 = 2**32-1;
    /**
     * Getters
    **/

    function totalPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvested);
    }

    function podIndex() public view returns (uint256) {
        return s.f.pods;
    }

    function harvestableIndex() public view returns (uint256) {
        return s.f.harvestable;
    }

    function harvestedIndex() public view returns (uint256) {
        return s.f.harvested;
    }

    function totalHarvestable() public view returns (uint256) {
        return s.f.harvestable.sub(s.f.harvested);
    }

    function totalUnripenedPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvestable);
    }

    function plot(address account, uint256 plotId) public view returns (uint256) {
        return s.a[account].field.plots[plotId];
    }

    function totalSoil() public view returns (uint256) {
        return s.f.soil;
    }

    /**
     * Internal
    **/

    function _sowBeans(uint256 amount) internal returns (uint256 pods) {
        pods = _sow(amount, msg.sender);
        bean().burn(amount);
        LibCheck.beanBalanceCheck();
    }
}