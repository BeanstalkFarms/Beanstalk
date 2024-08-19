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
 * @title LibTransmitIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibTransmitIn {
    using SafeCast for uint256;

    event DepositTransmittedIn(address indexed user, SourceDeposit deposit);

    event FertilizerTransmittedIn(address indexed user, SourceFertilizer fertilizer);

    event PlotTransmittedIn(address indexed user, SourcePlot sourcePlot);

    // Definitions must match source migration definitions. May require multiple definitions.
    struct SourceDeposit {
        address token;
        uint256 amount;
        int96 stem;
        uint256[] sourceMinTokenAmountsOut; // LP only
        uint256 destMinLpOut; // LP only
        uint256 lpDeadline; // LP only
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

    /**
     * @notice Mint and deposit new Beans and LP to the user, along with grown stalk.
     * @dev Mints Bean and LP at 1:1 ratio with source. This assumption can be altered in children.
     * @dev Underlying non-Bean tokens must already be transferred to this address.
     */
    function transmitInDeposits(address user, bytes[] calldata deposits) internal {
        if (deposits.length == 0) return;
        address[] memory whitelistedTokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < deposits.length; i++) {
            SourceDeposit memory deposit = abi.decode(deposits[i], (SourceDeposit));

            _alterDeposit(deposit);

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
                        deposit.lpDeadline
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
            emit DepositTransmittedIn(user, deposit);
        }
    }

    /**
     * @notice Mint equivalent fertilizer to the user such that they retain all remaining BPF.
     *
     * If there is a large gap in migrated plots then the line can be instantly pushed
     * all the way to the end of the hole. So if only one plot migrates, line can
     * immediately skip to that plot, even if it is at the end of the line.
     * Could partially mitigate with a no-sunrise migration window or a time delay
     * until inbound line can harvest.
     */
    function transmitInFertilizer(address user, bytes[] memory fertilizer) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (fertilizer.length == 0) return;
        for (uint256 i = 0; i < fertilizer.length; i++) {
            SourceFertilizer memory sourceFert = abi.decode(fertilizer[i], (SourceFertilizer));

            _alterFertilizer(sourceFert);

            // Update Beanstalk state and mint Fert to user. Bypasses standard minting calcs.
            LibFertilizer.IncrementFertState(sourceFert.amount, sourceFert._remainingBpf);
            C.fertilizer().beanstalkMint(
                user,
                s.sys.fert.bpf + sourceFert._remainingBpf,
                sourceFert.amount.toUint128(),
                s.sys.fert.bpf
            );
            emit FertilizerTransmittedIn(user, sourceFert);
        }
    }

    /**
     * @notice Create Plots in alternative Field and assign them to the migrating user.
     * @dev Holes between transmitted-in Plots are filled with Slashed Plots.
     * @dev Assumes that no sowing will occur in the same Field as inbound migrations.
     *
     * This contorted design is necessary to maintain constant time
     * harvest operations on a pod line that may contain holes. Null plots represent
     * holes in such a way that all pods can be accounted for and a plot can be acted
     * on without any knowledge of other plots.
     */
    function transmitInPlots(address user, bytes[] memory plots) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (plots.length == 0) return;
        for (uint256 i; i < plots.length; i++) {
            SourcePlot memory sourcePlot = abi.decode(plots[i], (SourcePlot));

            _alterPlot(sourcePlot);

            require(sourcePlot.fieldId == 0, "Field unsupported");
            // If the plot has missed harvesting or it was sown after destination deployment,
            // append the Plot to the end of the Pod line.
            if (
                sourcePlot.index < s.sys.fields[C.DEST_FIELD].harvestable ||
                sourcePlot.index > s.sys.fields[C.DEST_FIELD].srcInitPods
            ) {
                _plotPush(user, sourcePlot.amount);
            } else {
                _insertInNullPlot(
                    user,
                    sourcePlot.index,
                    sourcePlot.amount,
                    sourcePlot.existingIndex
                );
            }
            emit PlotTransmittedIn(user, sourcePlot);
        }
    }

    /**
     * @notice Insert a plot into an existing null plot.
     * @dev Requires that the existing plot is owned by null. This is possible bc null plots are
     *      always injected into gaps.
     */
    function _insertInNullPlot(
        address user,
        uint256 index,
        uint256 amount,
        uint256 existingIndex
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // prev plot is provided by user, but it is verified in insertion.
        uint256 existingAmount = s.accts[address(0)].fields[C.DEST_FIELD].plots[existingIndex];
        uint256 endIndex = existingIndex + existingAmount;
        require(existingAmount > 0, "existingIndex non null");
        require(existingIndex <= index, "existingIndex too large");
        require(endIndex >= index + amount, "endIndex too small");
        uint256 followingIndex = index + amount;
        uint256 followingAmount = endIndex - followingIndex;

        // Delete existing null plot.
        LibField.deletePlot(address(0), C.DEST_FIELD, existingIndex);

        // Create preceding null plot, user plot, and following null plot.
        LibField.createPlot(address(0), C.DEST_FIELD, existingIndex, index - existingIndex);
        LibField.createPlot(user, C.DEST_FIELD, index, amount);
        LibField.createPlot(address(0), C.DEST_FIELD, followingIndex, followingAmount);
        if (followingIndex > s.sys.fields[C.DEST_FIELD].latestTransmittedPlotIndex) {
            _updateLatestPlot(address(0), followingIndex, followingAmount);
        }
    }

    /**
     * @notice Insert a plot after the last existing in the Field. Null or non-null.
     */
    function _plotPush(address user, uint256 amount) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 index = s.sys.fields[C.DEST_FIELD].latestTransmittedPlotIndex +
            s
                .accts[s.sys.fields[C.DEST_FIELD].latestTransmittedPlotOwner]
                .fields[C.DEST_FIELD]
                .plots[s.sys.fields[C.DEST_FIELD].latestTransmittedPlotIndex];

        // Create preceding null plot and user plot.
        LibField.createPlot(user, C.DEST_FIELD, index, amount);
        _updateLatestPlot(user, index, amount);
    }

    function _updateLatestPlot(address user, uint256 index, uint256 amount) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.fields[C.DEST_FIELD].latestTransmittedPlotOwner = user;
        s.sys.fields[C.DEST_FIELD].latestTransmittedPlotIndex = index;
        s.sys.fields[C.DEST_FIELD].pods = index + amount;
    }

    function _initDestinationField(uint256 srcInitPods) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.fields[C.DEST_FIELD].srcInitPods = srcInitPods;
        _plotPush(address(0), srcInitPods);
    }

    function _alterDeposit(SourceDeposit memory deposit) private {
        // NOTE this is a placeholder for future child-specific logic.
        return;
    }

    function _alterFertilizer(SourceFertilizer memory fertilizer) private {
        // NOTE this is a placeholder for future child-specific logic.
        return;
    }

    function _alterPlot(SourcePlot memory plot) private {
        // NOTE this is a placeholder for future child-specific logic.
        return;
    }
}
