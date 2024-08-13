// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {LibMarket} from "contracts/libraries/LibMarket.sol";
import {LibField} from "contracts/libraries/LibField.sol";

/**
 * @title LibMigrateOut
 * @author funderbrker
 * @notice Library handling outbound migration and burning of protocol assets.
 */
library LibMigrateOut {
    // Need to define structs locally to contain additional migration information.

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
        uint256 prevDestIndex;
    }

    struct SourceFertilizer {
        uint128 id;
        uint256 amount;
        uint128 _remainingBpf;
    }

    // Current system does not offer a clean way to supply all deposits across all tokens.
    // Could instead (for deposits + fert + pods) have the external function arguments all be arrays of structs
    //      where the structs are the locally defined definitions. But this is a little sloppy, bc the structs are
    //      partially populate during the execution.
    //      Could use two structs: a selector struct and a migration definition struct. Seems very bloated.
    //      Could mark fields that do not need to be populated with a "_" prefix    <- this is a bit ugly, but i think best

    // TODO what to do with LP tokens? The destination does not want a token with the source Bean underlying it. Should unwind the LP, burn the bean, and send the non-Bean token.
    // TODO swapping / exiting LP will be difficult to implement with a proper minimum out.
    // remove in balanced ratio? with UI setting minimum out of each asset...
    /**
     * @notice Withdraw deposits and sends underlying ERC20 of asset. Burns Beans.
     * @return depositsOut The set of deposits to migrate, encoded as bytes.
     */
    function migrateOutDeposits(
        address user,
        address destination,
        SourceDeposit[] memory deposits
    ) internal returns (bytes[] memory depositsOut) {
        if (deposits.length == 0) return depositsOut;
        AppStorage storage s = LibAppStorage.diamondStorage();
        depositsOut = new bytes[](deposits.length);

        address[] memory tokensMown = new address[](s.sys.silo.whitelistStatuses.length);
        for (uint256 i; i < deposits.length; i++) {
            require(!LibUnripe.isUnripe(deposits[i].token), "Unripe not supported");

            // Mow each migrating token once.
            for (uint256 j; j < tokensMown.length; j++) {
                if (tokensMown[j] == deposits[i].token) {
                    break;
                }
                if (tokensMown[j] == address(0)) {
                    tokensMown[j] = deposits[i].token;
                    LibSilo._mow(user, deposits[i].token);
                    break;
                }
            }

            // Withdraw deposit from Silo.
            (, deposits[i]._grownStalk, , ) = LibSilo._withdrawDeposit(
                user,
                deposits[i].token,
                deposits[i].stem,
                deposits[i].amount
            );

            if (deposits[i].token == C.BEAN) {
                // Burn Bean.
                deposits[i]._burnedBeans = deposits[i].amount;
                C.bean().burn(deposits[i].amount);
            }
            // If Well LP token. Only supports Wells with Bean:Token.
            else if (LibWell.isWell(deposits[i].token)) {
                // Withdraw LP token.
                uint256[] memory tokenAmountsOut = IWell(deposits[i].token).removeLiquidity(
                    deposits[i].amount,
                    deposits[i].sourceMinTokenAmountsOut,
                    destination,
                    block.number
                );

                // Burn Bean.
                deposits[i]._burnedBeans = tokenAmountsOut[
                    LibWell.getBeanIndexFromWell(deposits[i].token)
                ];
                C.bean().burn(deposits[i]._burnedBeans);

                // Send non-Bean token.
                IERC20 nonBeanToken = LibWell.getNonBeanTokenFromWell(deposits[i].token);
                uint256 tokenAmount = tokenAmountsOut[
                    LibWell.getNonBeanIndexFromWell(deposits[i].token)
                ];
                LibTransfer.sendToken(
                    nonBeanToken,
                    tokenAmount,
                    destination,
                    LibTransfer.To.EXTERNAL
                );
                deposits[i]._transferredToken = address(nonBeanToken);
                deposits[i]._transferredTokenAmount = tokenAmount;
            } else {
                // Must be Bean or a whitelisted Well token.
                revert("Invalid token");
            }

            depositsOut[i] = abi.encode(deposits[i]);
        }
    }

    /**
     * @notice Slashes plots, which can later be burned. Populates and encodes migration data.
     * @return plotsOut The plots to migrate, encoded as bytes.
     * @dev Slashes the Pods by setting the owner to 0x0. They remain in Pod line until they
     *      become harvestable and can be Burned.
     */
    function migrateOutPlots(
        address account,
        SourcePlot[] memory plots
    ) internal returns (bytes[] memory plotsOut) {
        if (plotsOut.length == 0) return plotsOut;
        AppStorage storage s = LibAppStorage.diamondStorage();
        plotsOut = new bytes[](plots.length);
        for (uint256 i; i < plots.length; i++) {
            SourcePlot memory plot = plots[i];
            uint256 pods = s.accts[account].fields[plot.fieldId].plots[plot.index];
            require(plot.amount > 0, "No Pods to migrate");
            require(pods >= plot.amount, "Insufficient Pods");

            // Remove Plots from user.
            LibMarket._cancelPodListing(account, plot.fieldId, plot.index);
            LibField.deletePlot(account, plot.fieldId, plot.index);

            // Add new plots to null address.
            LibField.createPlot(address(0), plot.fieldId, plot.index, plot.amount);

            // Add partial plots back to user.
            uint256 remainingPods = pods - plot.amount;
            if (remainingPods > 0) {
                uint256 newIndex = plot.index + plot.amount;
                s.accts[account].fields[s.sys.activeField].plots[newIndex] = remainingPods;
                s.accts[account].fields[s.sys.activeField].plotIndexes.push(newIndex);
            }

            // Update Field counters.
            s.sys.fields[plot.fieldId].pods -= plot.amount;
        }
    }

    /**
     * @notice Burns Fertilizer. Populates and encodes migration data.
     * @return fertilizerOut The Fertilizer to migrate, encoded as bytes.
     */
    function migrateOutFertilizer(
        address account,
        SourceFertilizer[] memory fertilizer
    ) internal returns (bytes[] memory fertilizerOut) {
        if (fertilizer.length == 0) return fertilizerOut;
        AppStorage storage s = LibAppStorage.diamondStorage();
        fertilizerOut = new bytes[](fertilizer.length);

        /*
        0. Update user.
        1. Decrement each fert individually.
        2. Check leftoverBeans.
        */
        uint256[] memory ids = new uint256[](fertilizer.length);
        for (uint256 i; i < fertilizer.length; i++) {
            ids[i] = fertilizer[i].id;

            // Do not allow duplicate fertilizer IDs.
            for (uint256 j; j < i; j++) {
                require(ids[j] != fertilizer[i].id, "Duplicate Fertilizer ID");
            }

            uint128 remainingBpf = fertilizer[i].id - s.sys.fert.bpf;
            C.fertilizer().beanstalkBurn(
                account,
                s.sys.fert.bpf + remainingBpf,
                uint128(fertilizer[i].amount),
                s.sys.fert.bpf
            );
            LibFertilizer.decrementFertState(fertilizer[i].amount, remainingBpf);

            fertilizer[i]._remainingBpf = remainingBpf;
            fertilizerOut[i] = abi.encode(fertilizer[i]);
        }

        // If leftover beans are greater than obligations, drop excess leftovers. Rounding loss.
        uint256 unfertilizedBeans = s.sys.fert.unfertilizedIndex - s.sys.fert.fertilizedIndex;
        if (unfertilizedBeans < s.sys.fert.leftoverBeans) {
            s.sys.fert.leftoverBeans = 0;
        }
    }
}
