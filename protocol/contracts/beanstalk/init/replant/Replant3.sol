/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Replant3 removes all non-Deposited Beans stored in Beanstalk.
 * This includes:
 * Harvestable Plots
 * Pod Listings corresponding to Harvestable Plots
 * Pod Orders
 * Bean Withdrawals 
 * ------------------------------------------------------------------------------------
 **/
contract Replant3 {
    using SafeMath for uint256;
    AppStorage internal s;

    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event PodListingCancelled(address indexed account, uint256 indexed index);
    event PodOrderCancelled(address indexed account, bytes32 id);
    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);

    struct Plots {
        address account;
        uint256[] plots;
        uint256 amount;
    }

    struct Withdrawals {
        address account;
        uint32[] seasons;
        uint256 amount;
    }

    struct Listing {
        address account;
        uint256 plot;
    }

    struct Order {
        address account;
        bytes32 order;
    }

    function init(
        Plots[] calldata harvests,
        Listing[] calldata podListings,
        address partialAddress,
        uint256 partialIndex,
        Order[] calldata podOrders,
        Withdrawals[] calldata withdrawals
    ) external {
        for (uint256 i; i < harvests.length; ++i) {
            harvest(harvests[i].account, harvests[i].plots, harvests[i].amount);
        }
        harvestPartial(partialAddress, partialIndex);
        s.f.harvested = s.f.harvestable;

        for (uint256 i; i < podListings.length; ++i) {
            cancelPodListing(podListings[i].account, podListings[i].plot);
        }

        for (uint256 i; i < podOrders.length; ++i) {
            cancelPodOrder(podOrders[i].account, podOrders[i].order);
        }

        for (uint256 i; i < withdrawals.length; ++i) {
            claimWithdrawals(withdrawals[i].account, withdrawals[i].seasons, withdrawals[i].amount);
        }
    }

    function claimWithdrawals(address account, uint32[] calldata withdrawals, uint256 amount)
        private
    {
        emit BeanClaim(account, withdrawals, amount);
    }

    function harvest(address account, uint256[] calldata plots, uint256 amount)
        private
    {
        for (uint256 i; i < plots.length; ++i) {
            delete s.a[account].field.plots[plots[i]];
        }
        emit Harvest(account, plots, amount);
    }

    function harvestPartial(address account, uint256 plotId)
        private
    {
        uint256 pods = s.a[account].field.plots[plotId];
        uint256 beansHarvested = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];
        s.a[account].field.plots[plotId.add(beansHarvested)] = pods.sub(
            beansHarvested
        );
        uint256[] memory plots = new uint256[](1);
        plots[0] = plotId;
        emit Harvest(account, plots, beansHarvested);
    }

    function cancelPodListing(address account, uint256 index) internal {
        delete s.podListings[index];
        emit PodListingCancelled(account, index);
    }

    function cancelPodOrder(address account, bytes32 id) internal {
        delete s.podOrders[id];
        emit PodOrderCancelled(account, id);
    }
}
