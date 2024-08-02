/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Mock Contract with a getter and setter function
**/
contract MockContract {

    address account;

    function setAccount(address _account) external {
        account = _account;
    }

    function getAccount() external view returns (address _account) {
        _account = account;
    }

}
