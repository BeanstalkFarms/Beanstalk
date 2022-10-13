pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

interface ILiquityPriceFeed {
  function fetchPrice() external returns (uint);
}