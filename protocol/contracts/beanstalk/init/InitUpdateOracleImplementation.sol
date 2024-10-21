/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";

/**
 * @author Publius
 * @title InitUpdateOracleImplementation switches the WEETH and WSTETH oracle Implementation.
 **/
contract InitUpdateOracleImplementation {
    AppStorage internal s;
    address internal constant WSTETH = 0x5979D7b546E38E414F7E9822514be443A4800529;
    address internal constant WEETH = 0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe;

    function init() external {
        // get the wsteth oracle implementation
        Implementation memory wstethImplOld = s.sys.oracleImplementation[WSTETH];
        Implementation memory WeethImplOld = s.sys.oracleImplementation[WEETH];

        // switch the wsteth and weeth oracle implementations.
        LibWhitelist.updateOracleImplementationForToken(WSTETH, WeethImplOld);
        LibWhitelist.updateOracleImplementationForToken(WEETH, wstethImplOld);
    }
}
