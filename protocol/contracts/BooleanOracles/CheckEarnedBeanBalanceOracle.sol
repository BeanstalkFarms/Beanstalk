/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

interface IBeanstalk {
    function balanceOfEarnedBeans(address account)
        external
        view
        returns (uint256 beans);
}

/**
 * @title CheckEarnedBeanBalanceOracle
 * @author 0xm00neth
 */
contract CheckEarnedBeanBalanceOracle {
    /// @notice Beanstalk diamond address
    address public beanstalk;

    /// @notice Bean token address
    address public bean;

    /// @notice Constructor
    /// @param _beanstalk Beanstalk diamond address
    /// @param _bean Bean token address
    constructor(address _beanstalk, address _bean) {
        require(_beanstalk != address(0), "invalid beanstalk address");
        require(_bean != address(0), "invalid bean address");

        beanstalk = _beanstalk;
        bean = _bean;
    }

    /// @notice Check if user's earned bean balance is more than given amount
    /// @param _user User address to check
    /// @param _beans Balance amount to compare
    function checkEarnedBeanBalance(address _user, uint256 _beans)
        external
        view
        returns (bool)
    {
        uint256 beans = IBeanstalk(beanstalk).balanceOfEarnedBeans(_user);
        return beans >= _beans;
    }
}
