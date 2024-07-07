// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

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
        uint256 stem;
        uint256[] sourceMinTokenAmountsOut; // LP only
        uint256 destMinLpOut; // LP only
        uint256 _grownStalk; // not stalk // need to change logic
        uint256 _beansBurned;
        address _transferredToken; // NOTE what if LP type is not supported at destination?
        address _transferredTokenAmount;
    }

    struct SourcePlot {}

    struct SourceFertilizer {
        uint128 id;
        uint256 amount;
        uint256 _unfertilizedBpf;
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
     * @notice Withdraw deposits and send ERC20 of asset. Burns Beans.
     * @return The set of deposits to migrate, encoded as bytes.
     */
    function migrateOutDeposits(
        address user,
        address destination,
        SourceDeposit[] deposits
    ) private returns (bytes[] depositsOut) {
        depositsOut = bytes[](deposits.length);

        for (uint256 i; i < deposits.length; i++) {
            require(!LibUnripe.isUnripe(token), "Unripe not supported");

            deposits[i]._grownStalk = grownStalkForDeposit(
                user,
                deposits[i].token,
                deposits[i].stem
            );

            // Withdraw...
            _withdrawDeposit(user, deposits[i].token, deposits[i].stem, deposits[i].amount);

            if (deposits[i].token == C.BEAN) {
                // Burn Bean.
                deposits[i]._beansBurned = [deposits[i].amount];
                C.bean().burn(deposits[i].amount);
            }
            // If Well LP token. Only supports Wells with Bean:Token.
            else if (LibWell.isWell(deposits[i].token)) {
                // Withdraw LP token.
                uint256[] memory tokenAmountsOut = IWell.removeLiquidity(
                    deposits[i].amount,
                    deposits[i].sourceMinTokenAmountsOut,
                    destination,
                    block.number
                );

                // Burn Bean.
                deposits[i]._beansBurned = tokenAmountsOut[
                    LibWell.getBeanIndexFromWell(deposits[i].token)
                ];
                C.bean().burn(deposits[i]._beansBurned);

                // Send non-Bean token.
                address nonBeanToken = LibWell.getNonBeanTokenFromWell(deposits[i].token);
                uint256 tokenAmount = tokenAmountsOut[
                    LibWell.getNonBeanIndexFromWell(deposits[i].token)
                ];
                LibTransfer.sendToken(
                    nonBeanToken,
                    tokenAmount,
                    destination,
                    LibTransfer.To.EXTERNAL
                );
                deposits[i]._transferredToken = nonBeanToken;
                deposits[i]._transferredTokenAmount = tokenAmount;
            } else {
                // Must be Bean or a whitelisted Well token.
                revert("Invalid token");
            }

            depositsOut[i] = abi.encode(deposits[i]);
        }
    }

    /**
     * @notice Burns plots, according to this fork's configuration.
     * @return The plots to migrate, encoded as bytes.
     */
    function migrateOutPlots() internal returns (bytes[] plots);

    /**
     * @notice Burns Fertilizer, according to this fork's configuration.
     * @return The Fertilizer to migrate, encoded as bytes.
     */
    function migrateOutFertilizer(
        address account,
        SourceFertilizer[] calldata fertilizer,
        LibTransfer.To mode
    ) internal returns (bytes[] fertilizerOut) {
        fertilizerOut = bytes[](fertilizer.length);
        /*
        0. Update user
        1. Decrement s.sys.fert.activeFertilizer
        2. Decrement s.sys.fert.fertilizer[id]
        3. Decrement s.sys.fert.unfertilizedIndex
        4. Check leftoverBeans
        */
        uint256[] calldata ids = uint256[](fertilizer.length);
        uint256[] calldata amounts = uint256[](fertilizer.length);
        for (uint256 i; i++; i < fertilizer.length) {
            ids[i] = fertilizer[i].id;
            amounts[i] = fertilizer[i].amount;
        }

        LibFertilizer.claimFertilized(ids, mode);

        (
            uint256[] memory fertilizer,
            uint256 totalFertilizer,
            uint256[] remainingBpf,
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
