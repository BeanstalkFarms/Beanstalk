// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @title LibAltC
 * @notice Contains alternative Beanstalk constants for use with a second Beanstalk ecosystem in testing.
 *         Only contains address constants that diverge from actual Beanstalk.
 */
library LibAltC {
    address constant BEANSTALK = 0x00F84c1cF4Ca7fa8A8b0Dc923DA91ACA148B865C;
    address internal constant BEAN = 0x006DD9acC7cDf83128C4aDF46847c301f94406ab;

    address internal constant FERTILIZER = 0x00d180156a2680F1e776b165080200cffaDa463d;
    // address private constant FERTILIZER_ADMIN = ;

    address internal constant BEAN_ETH_WELL = 0x00c09d34D248ad13373193aA5Bc31876AfD577B5;
    address internal constant BEAN_WSTETH_WELL = 0x00Ba43411e3Bd86a49500778021a1b101A18cB94;

    // address constant PRICE_DEPLOYER = ;
    // address constant PRICE = ;
}
