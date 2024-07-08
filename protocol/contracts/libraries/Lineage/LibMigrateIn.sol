// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibMigrateIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibMigrateIn {
    // Definitions must match source migration definitions. May require multiple definitions.
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

    // Mint assets locally.
    // Underlying external ERC20s have already been transferred to destination beanstalk.
    // msg.sender == source instance
    // Use _depositTokensForConvert() to calculate stem (includes germination logic, germiantion safety provided by source beanstalk).
    function migrateInDeposits(address user, bytes[] deposits) internal {
        // NOTE give 1:1 token + BDV ??
        C.bean().mint(address(this), deposit.beansBurnt);

        address[] whitelistedTokens = LibWhitelist.getWhitelistedTokens();
        for (uint256 i = 0; i < deposits.length; i++) {
            SourceDeposit memory deposit = abi.decode(deposits[i], (SourceDeposit));

            // If LP deposit.
            if (deposit.transferredToken != address(0)) {
                bool lpMatched;
                // Look for corresponding whitelisted well.
                for (uint i; i < whitelistedTokens.length; i++) {
                    address well = whitelistedTokens[i];
                    address wellPairToken = LibWell.getNonBeanTokenFromWell(well);
                    if (wellPairToken != deposit.transferredToken) {
                        continue;
                    }
                    lpMatched = true;
                    uint256[] tokenAmountsIn = new uint256[](2);
                    tokenAmountsIn[LibWell.getBeanIndex(well)] = deposit.beansBurnt;
                    tokenAmountsIn[LibWell.getNonBeanIndex(well)] = deposit._transferredTokenAmount;

                    IERC20(deposit.transferredToken).approve(
                        well,
                        uint256(deposit._transferredTokenAmount)
                    );
                    C.bean().approve(well, deposit.beansBurnt);
                    uint256 lpAmount = IWell(whitelistedTokens[i]).addLiquidity(
                        tokenAmountsIn,
                        deposit.minLpAmountOut,
                        address(this),
                        block.number
                    );
                    
                    LibConvert._depositTokensForConvert(
                        well,
                        lpAmount, // amount
                        LibWellBdv.bdv(well, lpAmount), // bdv
                        deposit._grownStalk
                    );
                    break;
                }
                require(lpMatched, "LP not whitelisted");
            }
            // else if Bean deposit.
            else {
                // Update Beanstalk state and mint Beans to user. Bypasses standard minting calcs.
                LibConvert._depositTokensForConvert(
                    C.BEAN,
                    deposit.burnedBeans, // amount
                    deposit.burnedBeans, // bdv
                    deposit._grownStalk
                );
            }
        }
    }

    function migrateInPlots(address user, bytes[] plots) internal;

    /**
     * @notice Mint equivalent fertilizer to the user such that they retain all remaining BPF.
     */
    function migrateInFertilizer(address user, bytes[] fertilizer) internal {
        for (uint256 i = 0; i < fertilizer.length; i++) {
            SourceFertilizer memory sourceFert = abi.decode(fertilizer[i], (SourceFertilizer));

            // Update Beanstalk state and mint Fert to user. Bypasses standard minting calcs.
            LibFertilizer.IncrementFertState(sourceFert.amount, sourceFert._unfertilizedBpf);
            C.fertilizer().beanstalkMint(
                user,
                s.sys.fert.bpf + _unfertilizedBpf,
                amount.toUint128(),
                s.sys.fert.bpf
            );
        }
    }
}
