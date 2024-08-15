// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibWellBdv} from "contracts/libraries/Well/LibWellBdv.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibField} from "contracts/libraries/LibField.sol";

/**
 * @title LibMigrateIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibMigrateIn {
    using SafeCast for uint256;

    event DepositMigratedIn(address indexed user, SourceDeposit deposit);

    event FertilizerMigratedIn(address indexed user, SourceFertilizer fertilizer);

    event PlotMigratedIn(address indexed user, SourcePlot sourcePlot);

    uint256 internal constant IN_FIELD = 9;

    // Definitions must match source migration definitions. May require multiple definitions.
    struct SourceDeposit {
        address token;
        uint256 amount;
        int96 stem;
        uint256[] sourceMinTokenAmountsOut; // LP only
        uint256 destMinLpOut; // LP only
        uint256 _grownStalk; // not stalk // need to change logic
        uint256 _burnedBeans;
        address _transferredToken; // NOTE what if LP type is not supported at destination?
        uint256 _transferredTokenAmount;
    }

    struct SourcePlot {
        uint256 fieldId;
        uint256 index;
        uint256 amount;
        uint256 existingIndex;
    }

    struct SourceFertilizer {
        uint128 id;
        uint256 amount;
        uint128 _remainingBpf;
    }

    uint256 internal constant IN_FIELD = 9;

    // Mint assets locally.
    // Underlying external ERC20s have already been transferred to destination beanstalk.
    // msg.sender == source instance
    // Use _depositTokensForConvert() to calculate stem (includes germination logic, germiantion safety provided by source beanstalk).
    function migrateInDeposits(address user, bytes[] calldata deposits) internal {
        if (deposits.length == 0) return;
        address[] memory whitelistedTokens = LibWhitelistedTokens.getWhitelistedTokens();
        for (uint256 i = 0; i < deposits.length; i++) {
            SourceDeposit memory deposit = abi.decode(deposits[i], (SourceDeposit));
            // NOTE give 1:1 token + BDV ??
            C.bean().mint(address(this), deposit._burnedBeans);

            // If LP deposit.
            if (deposit._transferredToken != address(0)) {
                bool lpMatched;
                // Look for corresponding whitelisted well.
                for (uint j; j < whitelistedTokens.length; j++) {
                    address well = whitelistedTokens[j];
                    if (
                        address(LibWell.getNonBeanTokenFromWell(well)) != deposit._transferredToken
                    ) {
                        continue;
                    }
                    uint256[] memory tokenAmountsIn = new uint256[](2);
                    tokenAmountsIn[LibWell.getBeanIndexFromWell(well)] = deposit._burnedBeans;
                    tokenAmountsIn[LibWell.getNonBeanIndexFromWell(well)] = deposit
                        ._transferredTokenAmount;

                    IERC20(deposit._transferredToken).approve(
                        well,
                        uint256(deposit._transferredTokenAmount)
                    );
                    C.bean().approve(well, deposit._burnedBeans);
                    uint256 lpAmount = IWell(whitelistedTokens[j]).addLiquidity(
                        tokenAmountsIn,
                        deposit.destMinLpOut,
                        address(this),
                        block.number
                    );

                    LibConvert._depositTokensForConvert(
                        user,
                        well,
                        lpAmount, // amount
                        LibWellBdv.bdv(well, lpAmount), // bdv
                        deposit._grownStalk
                    );
                    lpMatched = true;
                    break;
                }
                require(lpMatched, "LP not whitelisted");
            }
            // else if Bean deposit.
            else {
                // Update Beanstalk state and mint Beans to user. Bypasses standard minting calcs.
                LibConvert._depositTokensForConvert(
                    user,
                    C.BEAN,
                    deposit._burnedBeans, // amount
                    deposit._burnedBeans, // bdv
                    deposit._grownStalk
                );
            }
            emit DepositMigratedIn(user, deposit);
        }
    }

    /**
     * @notice Mint equivalent fertilizer to the user such that they retain all remaining BPF.
     */
    function migrateInFertilizer(address user, bytes[] memory fertilizer) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (fertilizer.length == 0) return;
        for (uint256 i = 0; i < fertilizer.length; i++) {
            SourceFertilizer memory sourceFert = abi.decode(fertilizer[i], (SourceFertilizer));

            // Update Beanstalk state and mint Fert to user. Bypasses standard minting calcs.
            LibFertilizer.IncrementFertState(sourceFert.amount, sourceFert._remainingBpf);
            C.fertilizer().beanstalkMint(
                user,
                s.sys.fert.bpf + sourceFert._remainingBpf,
                sourceFert.amount.toUint128(),
                s.sys.fert.bpf
            );
            emit FertilizerMigratedIn(user, sourceFert);
        }
    }

    /**
     * @notice Create Plots in alternative Field and assign them to the migrating user.
     * @dev Holes between migrated-in Plots are filled with Slashed Plots.
     * @dev Assumes that no sowing will occur in the same Field as inbound migrations.
     *
     * This design is painfully contorted. This is necessary to maintain constant time
     * harvest operations on a pod line that may contain holes. Null plots represent
     * hols in such a way that all pods can be accounted for and a plot can be acted
     * on without any knowledge of other plots.
     */
    function migrateInPlots(address user, bytes[] memory plots) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (plots.length == 0) return;
        // This Destination configuration expects all source Plots to be in the same Field.
        for (uint256 i; i < plots.length; i++) {
            SourcePlot memory sourcePlot = abi.decode(plots[i], (SourcePlot));
            require(sourcePlot.fieldId == 0, "Field unsupported");
            // require(sourcePlot.amount > 1000e6, "Too small");
            require(sourcePlot.index > s.sys.fields[IN_FIELD].harvestable); // 0 index not supported
            if (sourcePlot.index > s.sys.fields[IN_FIELD].latestMigratedPlotIndex) {
                _insertAfterLastPlot(user, sourcePlot.index, sourcePlot.amount);
            } else {
                _insertInNullPlot(
                    user,
                    sourcePlot.index,
                    sourcePlot.amount,
                    sourcePlot.existingIndex
                );
            }
            emit PlotMigratedIn(user, sourcePlot);
        }
    }

    function _insertInNullPlot(
        address user,
        uint256 index,
        uint256 amount,
        uint256 existingIndex
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // prev plot is provided by user, but it is verified in insertion.
        uint256 prevAmount = s.accts[address(0)].fields[IN_FIELD].plots[existingIndex];
        uint256 nextIndex = existingIndex + prevAmount;
        require(prevAmount > 0, "non null");
        require(existingIndex <= index, "existingIndex too large");
        require(nextIndex >= index + amount, "nextIndex too small");

        // Delete existing null plot.
        LibField.deletePlot(address(0), IN_FIELD, existingIndex);

        // Create preceding null plot, user plot, and following null plot.
        LibField.createPlot(address(0), IN_FIELD, existingIndex, index - existingIndex);
        LibField.createPlot(user, IN_FIELD, index, amount);
        LibField.createPlot(address(0), IN_FIELD, index + amount, nextIndex - (index + amount));
    }

    function _insertAfterLastPlot(address user, uint256 index, uint256 amount) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 nextIndex = s.sys.fields[IN_FIELD].latestMigratedPlotIndex +
            s.accts[s.sys.fields[IN_FIELD].latestMigratedPlotOwner].fields[IN_FIELD].plots[
                s.sys.fields[IN_FIELD].latestMigratedPlotIndex
            ];

        // Create preceding null plot and user plot.
        LibField.createPlot(address(0), IN_FIELD, nextIndex, index - nextIndex);
        LibField.createPlot(user, IN_FIELD, index, amount);

        s.sys.fields[IN_FIELD].latestMigratedPlotIndex = index;
        s.sys.fields[IN_FIELD].latestMigratedPlotOwner = user;
    }
}
