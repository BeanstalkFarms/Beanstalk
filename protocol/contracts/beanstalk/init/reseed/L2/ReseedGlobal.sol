/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "contracts/beanstalk/storage/System.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedGlobal sets the global state of Beanstalk.
 * @dev Pod Orders and Listings are ommited and are set in a seperate reseed contract.
 */
contract ReseedGlobal {
    AppStorage internal s;

    /**
     * @param system contains the global state of Beanstalk.
     * 1) replaces mappings with arrays, so that the state can be re-initialized.
     * 2) omits variables that do not need to be set.
     * 3) omits Pod Orders and Listings. (Set in ReseedOrders.sol)
     */
    struct ReseedSystemData {
        SystemInternalBalances sysBalances;
        SystemFertilizer sysFert;
        SystemSilo sysSilo;
        Field f;
        Season s;
        Weather w;
        SeedGauge sg;
        Rain r;
        EvaluationParameters ep;
        Migration migration;
        ShipmentRoute[] shipmentRoutes;
    }

    struct SystemInternalBalances {
        IERC20[] tokens;
        uint256[] internalTokenBalanceTotal;
    }
    /**
     * @notice contains data related to the system's Silo.
     */
    struct SystemSilo {
        uint256 stalk;
        uint256 roots;
        uint256 earnedBeans;
        uint256 orderLockedBeans;
        address[] tokens;
        AssetSilo[] balances;
        UnripeSettings[] u;
        Deposited[] germDepositEven;
        Deposited[] germDepositOdd;
        uint32[] unclaimedGerminatingSeasons;
        GerminatingSilo[] unclaimedGerminating;
    }

    /**
     * @notice contains data related to the system's fertilizer.
     * @dev `fertilizerIds` and `fertilizerAmounts` are used to recreate the
     * `fertilizer` and `nextFid` mapping.
     */
    struct SystemFertilizer {
        uint128[] fertilizerIds;
        uint256[] fertilizerAmounts;
        uint256 activeFertilizer;
        uint256 fertilizedIndex;
        uint256 unfertilizedIndex;
        uint256 fertilizedPaidIndex;
        uint128 fertFirst;
        uint128 fertLast;
        uint128 bpf;
        uint256 recapitalized;
        uint256 leftoverBeans;
    }

    /**
     * @notice initializes the global state of Beanstalk.
     */
    function init(ReseedSystemData calldata system) external {
        s.sys.reentrantStatus = 1;
        s.sys.isFarm = 1;
        s.sys.activeField = 0;
        s.sys.fieldCount = 1;

        LibCases.setCasesV2();
        setShipmentRoutes(system.shipmentRoutes);
        setSilo(system.sysSilo);
        setFertilizer(system.sysFert);
        s.sys.fields[0] = system.f;
        s.sys.season = system.s;
        s.sys.weather = system.w;
        s.sys.seedGauge = system.sg;
        s.sys.rain = system.r;
        s.sys.evaluationParameters = system.ep;

        // initalize tractor:
        setTractor();
    }

    /**
     * @notice sets the Fertilizer data.
     */
    function setFertilizer(SystemFertilizer calldata fert) internal {
        for (uint256 i; i < fert.fertilizerIds.length; i++) {
            s.sys.fert.fertilizer[fert.fertilizerIds[i]] = fert.fertilizerAmounts[i];

            if (i != 0) s.sys.fert.nextFid[fert.fertilizerIds[i - 1]] = fert.fertilizerIds[i];
        }
        s.sys.fert.activeFertilizer = fert.activeFertilizer;
        s.sys.fert.fertilizedIndex = fert.fertilizedIndex;
        s.sys.fert.unfertilizedIndex = fert.unfertilizedIndex;
        s.sys.fert.fertilizedPaidIndex = fert.fertilizedPaidIndex;
        s.sys.fert.fertFirst = fert.fertFirst;
        s.sys.fert.fertLast = fert.fertLast;
        s.sys.fert.bpf = fert.bpf;
        s.sys.fert.recapitalized = fert.recapitalized;
        s.sys.fert.leftoverBeans = fert.leftoverBeans;
    }

    /**
     * @notice initializes the Global silo settings.
     * @dev assumes the first two tokens are unripe tokens.
     * Assumes correct index matching.
     */
    function setSilo(SystemSilo calldata silo) internal {
        s.sys.silo.stalk = silo.stalk;
        s.sys.silo.roots = silo.roots;
        s.sys.silo.earnedBeans = silo.earnedBeans;
        s.sys.orderLockedBeans = silo.orderLockedBeans;

        // loop through tokens:
        for (uint i; i < silo.tokens.length; i++) {
            address token = silo.tokens[i];
            if (i < 2) {
                s.sys.silo.unripeSettings[token] = silo.u[i];
            }
            s.sys.silo.balances[token] = silo.balances[i];
        }

        for (uint i; i < silo.germDepositEven.length; i++) {
            s.sys.silo.germinating[GerminationSide.ODD][silo.tokens[i]] = silo.germDepositEven[i];
            s.sys.silo.germinating[GerminationSide.EVEN][silo.tokens[i]] = silo.germDepositEven[i];
        }

        for (uint i; i < silo.unclaimedGerminatingSeasons.length; i++) {
            uint32 season = silo.unclaimedGerminatingSeasons[i];
            s.sys.silo.unclaimedGerminating[season] = silo.unclaimedGerminating[i];
        }
    }

    /**
     * @notice sets the routes.
     * @dev Solidity does not support direct assignment of array structs to Storage.
     */
    function setShipmentRoutes(ShipmentRoute[] calldata routes) internal {
        for (uint i; i < routes.length; i++) {
            s.sys.shipmentRoutes.push(routes[i]);
        }
    }

    function setTractor() internal {
        LibTractor.TractorStorage storage ts = LibTractor._tractorStorage();
        ts.activePublisher = payable(address(1));
        ts.version = "1.0.0";
    }
}
