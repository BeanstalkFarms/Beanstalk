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
        address n;
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

            deposits[i]._grownStalk = LibTokenSilo.grownStalkForDeposit(
                user,
                deposits[i].token,
                deposits[i].stem
            );

            // Withdraw deposit from Silo.
            LibSilo._withdrawDeposit(user, deposits[i].token, deposits[i].stem, deposits[i].amount);

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
     * @notice Burns plots. Populates and encodes migration data.
     * @return plotsOut The plots to migrate, encoded as bytes.
     * @dev Removes market listings.
     */
    function migrateOutPlots() internal pure returns (bytes[] memory plotsOut) {
        return plotsOut;
    }

    /**
     * @notice Burns Fertilizer. Populates and encodes migration data.
     * @return fertilizerOut The Fertilizer to migrate, encoded as bytes.
     */
    function migrateOutFertilizer(
        address account,
        SourceFertilizer[] memory fertilizer
    ) internal returns (bytes[] memory fertilizerOut) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        fertilizerOut = new bytes[](fertilizer.length);
        /*
        0. Update user
        1. Decrement s.sys.fert.activeFertilizer
        2. Decrement s.sys.fert.fertilizer[id]
        3. Decrement s.sys.fert.unfertilizedIndex
        4. Check leftoverBeans
        */
        uint256[] memory ids = new uint256[](fertilizer.length);
        uint256[] memory amounts = new uint256[](fertilizer.length);
        for (uint256 i; i < fertilizer.length; i++) {
            ids[i] = fertilizer[i].id;
            amounts[i] = fertilizer[i].amount;
        }

        LibFertilizer.claimFertilized(ids, LibTransfer.To.INTERNAL);
        (
            uint256 totalFertilizer,
            uint128[] memory remainingBpf,
            uint256 totalUnfertilized
        ) = LibFertilizer.getAmountsOfIds(account, ids, amounts);

        s.sys.fert.activeFertilizer -= totalFertilizer;
        s.sys.fert.unfertilizedIndex -= totalUnfertilized;
        for (uint256 i; i < ids.length; i++) {
            s.sys.fert.fertilizer[fertilizer[i].id] -= fertilizer[i].amount;
            fertilizer[i]._remainingBpf = remainingBpf[i];
            fertilizerOut[i] = abi.encode(fertilizer[i]);
        }

        // If leftover beans are greater than obligations, drop excess leftovers. Rounding loss.
        uint256 unfertilizedBeans = s.sys.fert.unfertilizedIndex - s.sys.fert.fertilizedIndex;
        if (unfertilizedBeans > s.sys.fert.leftoverBeans) {
            s.sys.fert.leftoverBeans = unfertilizedBeans;
        }
    }
}
