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

/**
 * @title LibMigrateIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibMigrateIn {
    using SafeCast for uint256;

    event SupportedSourceAdded(address source);

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
        address n;
    }

    struct SourceFertilizer {
        uint128 id;
        uint256 amount;
        uint128 _remainingBpf;
    }

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
                    lpMatched = true;
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
        }
    }

    function migrateInPlots(address user, bytes[] memory plots) internal pure {
        return;
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
        }
    }

    /**
     * @notice Adds a supported source from which farmers can migrate.
     */
    function addSupportedSource(address source) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.lineage.supportedSources[source] = true;
        emit SupportedSourceAdded(source);
    }
}
