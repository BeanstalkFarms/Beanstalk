/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitEBip6 updates the mappings of Pod Orders created before BIP-29.
 **/
contract InitEBip6 {
    AppStorage internal s;

    function init() external {
        s.podOrders[0x6f668ae24be6e177f8584600dbffea6e07f260e08e21fa47792385913e786da3] = 10_491_929_346;
        s.podOrders[0xf47df2678d29e9d57c5e9ed5f8c990e71910918154a2ed6d5235718035d7d8b0] = 1_466_423;
        s.podOrders[0x186c6468ca4d3ce2575b9527fcf42cc3c86ab7cc915a550c9e84c5443691607a] = 380;
    }

}
