/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../interfaces/IBean.sol";
import "../../../libraries/LibDibbler.sol";
import "../../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Dibbler
**/
contract BeanDibbler is ReentrancyGuard{

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

    event Sow(address indexed account, uint256 index, uint256 beans, uint256 pods);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event PodListingCancelled(address indexed account, uint256 indexed index);

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

    function _sowBeans(uint256 amount, bool fromWallet) internal returns (uint256 pods) {
        pods = LibDibbler.sow(amount, msg.sender);
        if (fromWallet) bean().burnFrom(msg.sender, amount);
        else bean().burn(amount);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}