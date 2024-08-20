/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {Field} from "contracts/beanstalk/storage/Account.sol";

/**
 * @author funderbrker
 * @title LibField
 **/

library LibField {
    /**
     * @dev Does not check for existence of index in plotIndexes.
     * @dev Plot indexes not tracked for null address.
     */
    function createPlot(address account, uint256 fieldId, uint256 index, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (amount == 0) return;
        s.accts[account].fields[fieldId].plots[index] = amount;
        if (account != address(0)) {
            s.accts[account].fields[fieldId].plotIndexes.push(index);
            s.accts[account].fields[fieldId].piIndex[index] =
                s.accts[account].fields[fieldId].plotIndexes.length -
                1;
        }
    }

    /**
     * @dev Plot indexes are not tracked for null address.
     */
    function deletePlot(address account, uint256 fieldId, uint256 index) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        delete s.accts[account].fields[fieldId].plots[index];
        if (account != address(0)) removePlotIndexFromAccount(account, fieldId, index);
    }

    /**
     * @notice removes a plot index from an accounts plotIndex list.
     */
    function removePlotIndexFromAccount(
        address account,
        uint256 fieldId,
        uint256 plotIndex
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 i = findPlotIndexForAccount(account, fieldId, plotIndex);
        Field storage field = s.accts[account].fields[fieldId];
        field.plotIndexes[i] = field.plotIndexes[field.plotIndexes.length - 1];
        field.plotIndexes.pop();
    }

    /**
     * @notice finds the index of a plot in an accounts plotIndex list.
     */
    function findPlotIndexForAccount(
        address account,
        uint256 fieldId,
        uint256 plotIndex
    ) internal view returns (uint256 i) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Field storage field = s.accts[account].fields[fieldId];
        uint256[] memory plotIndexes = field.plotIndexes;
        uint256 length = plotIndexes.length;
        while (plotIndexes[i] != plotIndex) {
            i++;
            if (i >= length) {
                revert("Id not found");
            }
        }
        return i;
    }
}
