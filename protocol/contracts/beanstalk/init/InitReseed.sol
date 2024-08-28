/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "contracts/interfaces/IDiamondLoupe.sol";

/**
 * @author Brean
 * @notice InitReseed reseeds Beanstalk.
 */
contract InitReseed {
    AppStorage internal s;

    address internal constant BEAN = 0xBEA0005B8599265D41256905A9B3073D397812E4;
    address internal constant UNRIPE_BEAN = 0x1BEA054dddBca12889e07B3E076f511Bf1d27543;
    address internal constant UNRIPE_LP = 0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788;
    address internal constant BEAN_WSTETH_LP = 0xBEA0039bC614D95B65AB843C4482a1A5D2214396;

    event Reseed(uint256 timestamp);

    function init() external {
        s.sys.paused = false;

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

        // set the start of the Season based on the number of seasons,
        // rounding down to the nearest hour.
        s.sys.season.start =
            ((s.sys.season.timestamp / s.sys.season.period) * s.sys.season.period) -
            (s.sys.season.period * s.sys.season.current);

        // add unripe tokens
        // set the underlying token of the unripe bean to bean.
        s.sys.silo.unripeSettings[UNRIPE_BEAN].underlyingToken = BEAN;
        // set the underlying token of the unripe lp to BeanWstethLP.
        s.sys.silo.unripeSettings[UNRIPE_LP].underlyingToken = BEAN_WSTETH_LP;
        emit Reseed(block.timestamp);
    }
}
