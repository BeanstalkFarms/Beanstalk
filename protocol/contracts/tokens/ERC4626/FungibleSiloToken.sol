// pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

// import "@openzeppelin/contracts-upgradeable-8/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable-8/proxy/utils/UUPSUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable-8/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable-8/interfaces/IERC4626Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable-8/utils/math/MathUpgradeable.sol";

// import "../../interfaces/IBeanstalk.sol";

// contract FungibleSiloToken is
//     UUPSUpgradeable,
//     ERC20PermitUpgradeable,
//     OwnableUpgradeable,
//     IERC4626Upgradeable
// {
//     using MathUpgradeable for uint256;

//     address public constant BEANSTALK_ADDRESS = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
//     address public siloTokenAddress;
//     uint8 public siloTokenDecimals;

//     uint32 public depositedSiloSeason;
//     uint216 public depositedSiloAmount;

//     function initialize(
//         address _siloTokenAddress,
//         uint8 _siloTokenDecimals,
//         uint32 _season,
//         string memory name,
//         string memory symbol
//     ) public initializer {
//         __ERC20_init(name, symbol);
//         __ERC20Permit_init(name);
//         __Ownable_init();
//         siloTokenAddress = _siloTokenAddress;
//         depositedSiloSeason = _season;
//         depositedSiloAmount = 0;
//         siloTokenDecimals = _siloTokenDecimals;
//     }

//     function _authorizeUpgrade(address) internal override onlyOwner {}

//     // ERC4626
//     /** @dev See {IERC4262-asset}. */
//     function asset() public view virtual override returns (address) {
//         return siloTokenAddress;
//     }

//     /** @dev See {IERC4262-totalAssets}. */
//     function totalAssets() public view virtual override returns (uint256) {
//         return depositedSiloAmount;
//     }

//     /** @dev See {IERC4262-convertToShares}. */
//     function convertToShares(uint256 assets)
//         public
//         view
//         virtual
//         override
//         returns (uint256 shares)
//     {
//         return _convertToShares(assets, MathUpgradeable.Rounding.Down);
//     }

//     /** @dev See {IERC4262-convertToAssets}. */
//     function convertToAssets(uint256 shares)
//         public
//         view
//         virtual
//         override
//         returns (uint256 assets)
//     {
//         return _convertToAssets(shares, MathUpgradeable.Rounding.Down);
//     }

//     /** @dev See {IERC4262-maxDeposit}. */
//     function maxDeposit(address)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _isVaultCollateralized() ? type(uint256).max : 0;
//     }

//     /** @dev See {IERC4262-maxMint}. */
//     function maxMint(address) public view virtual override returns (uint256) {
//         return type(uint256).max;
//     }

//     /** @dev See {IERC4262-maxWithdraw}. */
//     function maxWithdraw(address owner)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return
//             _convertToAssets(balanceOf(owner), MathUpgradeable.Rounding.Down);
//     }

//     /** @dev See {IERC4262-maxRedeem}. */
//     function maxRedeem(address owner)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return balanceOf(owner);
//     }

//     /** @dev See {IERC4262-previewDeposit}. */
//     function previewDeposit(uint256 assets)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _convertToShares(assets, MathUpgradeable.Rounding.Down);
//     }

//     /** @dev See {IERC4262-previewMint}. */
//     function previewMint(uint256 shares)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _convertToAssets(shares, MathUpgradeable.Rounding.Up);
//     }

//     /** @dev See {IERC4262-previewWithdraw}. */
//     function previewWithdraw(uint256 assets)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _convertToShares(assets, MathUpgradeable.Rounding.Up);
//     }

//     /** @dev See {IERC4262-previewRedeem}. */
//     function previewRedeem(uint256 shares)
//         public
//         view
//         virtual
//         override
//         returns (uint256)
//     {
//         return _convertToAssets(shares, MathUpgradeable.Rounding.Down);
//     }

//     function createTempArrayAndConvert(uint32 season, uint256 amount) internal {
//         uint32[] memory tempSeasons = new uint32[](2);
//         uint256[] memory tempAmounts = new uint256[](2);
//         tempSeasons[0] = season;
//         tempAmounts[0] = amount;
//         tempSeasons[1] = depositedSiloSeason;
//         tempAmounts[1] = depositedSiloAmount;
//         convertAndUpdate(tempSeasons, tempAmounts, amount + depositedSiloAmount);
//     }

//     function convertAndUpdate(
//         uint32[] memory seasons,
//         uint256[] memory amounts,
//         uint256 totalAmount
//     ) internal {
//         (uint32 toSeason, uint256 toAmount) = IBeanstalk(BEANSTALK_ADDRESS)
//             .convert(
//                 abi.encode(
//                     ConvertKind.LAMBDA_LAMBDA,
//                     totalAmount,
//                     siloTokenAddress
//                 ),
//                 seasons,
//                 amounts
//             );

//         //  Update stored season/amount
//         depositedSiloAmount = uint216(toAmount);
//         depositedSiloSeason = toSeason;
//     }

//     function earn() public {
//         uint256 newBean = IBeanstalk(BEANSTALK_ADDRESS).plant();
//         uint32 currentSeason = IBeanstalk(BEANSTALK_ADDRESS).season();
//         createTempArrayAndConvert(currentSeason, newBean);
//     }

//     /** @dev See {IERC4262-deposit}. */
//     function deposit(uint256 assets, address receiver)
//         public
//         virtual
//         override
//         returns (uint256)
//     {
//         require(
//             assets <= maxDeposit(receiver),
//             "ERC4626: deposit more than max"
//         );
//         uint256 shares = previewDeposit(assets);
//         _deposit(msg.sender, receiver, depositedSiloSeason, assets, shares);
//         return shares;
//     }

//     function depositWithSeason(
//         uint32 season,
//         uint256 assets,
//         address receiver
//     ) public virtual returns (uint256) {
//         require(
//             assets <= maxDeposit(receiver),
//             "ERC4626: deposit more than max"
//         );
//         require(
//             season <= depositedSiloSeason,
//             "ERC4626: deposit season is greater than allowed season"
//         );
//         uint256 shares = previewDeposit(assets);
//         _deposit(msg.sender, receiver, season, assets, shares);
//         return shares;
//     }

//     function depositWithSeasons(
//         uint32[] calldata seasons,
//         uint256[] calldata amounts,
//         address receiver
//     ) public virtual returns (uint256) {
//         uint256 assets;
//         for (uint256 i = 0; i < amounts.length; i++) {
//             require(
//                 seasons[i] <= depositedSiloSeason,
//                 "ERC4626: deposit season is greater than allowed season"
//             );
//             assets += amounts[i];
//         }
//         require(
//             assets <= maxDeposit(receiver),
//             "ERC4626: deposit more than max"
//         );

//         uint256 shares = previewDeposit(assets);
//         _deposits(_msgSender(), receiver, seasons, amounts, shares, assets);

//         return shares;
//     }

//     /** @dev See {IERC4262-mint}. */
//     function mint(uint256 shares, address receiver)
//         public
//         virtual
//         override
//         returns (uint256)
//     {
//         require(shares <= maxMint(receiver), "ERC4626: mint more than max");
//         uint256 assets = previewMint(shares);
//         _deposit(_msgSender(), receiver, depositedSiloSeason, assets, shares);
//         return assets;
//     }

//     /** @dev See {IERC4262-withdraw}. */
//     function withdraw(
//         uint256 assets,
//         address receiver,
//         address owner
//     ) public virtual override returns (uint256) {
//         require(
//             assets <= maxWithdraw(owner),
//             "ERC4626: withdraw more than max"
//         );

//         uint256 shares = previewWithdraw(assets);
//         _withdraw(_msgSender(), receiver, owner, assets, shares);
//         return shares;
//     }

//     /** @dev See {IERC4262-redeem}. */
//     function redeem(
//         uint256 shares,
//         address receiver,
//         address owner
//     ) public virtual override returns (uint256) {
//         require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");

//         uint256 assets = previewRedeem(shares);
//         _withdraw(_msgSender(), receiver, owner, assets, shares);

//         return assets;
//     }

//     /**
//      * @dev Internal conversion function (from assets to shares) with support for rounding direction.
//      *
//      * Will revert if assets > 0, totalSupply > 0 and totalAssets = 0. That corresponds to a case where any asset
//      * would represent an infinite amout of shares.
//      */
//     function _convertToShares(uint256 assets, MathUpgradeable.Rounding rounding)
//         internal
//         view
//         virtual
//         returns (uint256 shares)
//     {
//         uint256 supply = totalSupply();
//         return
//             (assets == 0 || supply == 0)
//                 ? assets.mulDiv(10**decimals(), 10**siloTokenDecimals, rounding)
//                 : assets.mulDiv(supply, totalAssets(), rounding);
//     }

//     /**
//      * @dev Internal conversion function (from shares to assets) with support for rounding direction.
//      */
//     function _convertToAssets(uint256 shares, MathUpgradeable.Rounding rounding)
//         internal
//         view
//         virtual
//         returns (uint256 assets)
//     {
//         uint256 supply = totalSupply();
//         return
//             (supply == 0)
//                 ? shares.mulDiv(10**siloTokenDecimals, 10**decimals(), rounding)
//                 : shares.mulDiv(totalAssets(), supply, rounding);
//     }

//     /**
//      * @dev Deposit/mint common workflow.
//      */
//     function _deposit(
//         address caller,
//         address receiver,
//         uint32 season,
//         uint256 assets,
//         uint256 shares
//     ) internal virtual {
//         // Transfer silo deposit to contract
//         IBeanstalk(BEANSTALK_ADDRESS).transferDeposit(
//             caller,
//             address(this),
//             siloTokenAddress,
//             season,
//             assets
//         );

//         createTempArrayAndConvert(season, assets);

//         // Mint
//         _mint(receiver, shares);
//         emit Deposit(caller, receiver, assets, shares);
//     }

//     function _deposits(
//         address caller,
//         address receiver,
//         uint32[] calldata seasons,
//         uint256[] calldata amounts,
//         uint256 shares,
//         uint256 assets
//     ) internal virtual {
//         // Transfer silo deposit to contract
//         IBeanstalk(BEANSTALK_ADDRESS).transferDeposits(
//             caller,
//             address(this),
//             siloTokenAddress,
//             seasons,
//             amounts
//         );

//         // Convert silo deposit with contract silo deposit
//         uint32[] memory tempSeasons = new uint32[](seasons.length + 1);
//         uint256[] memory tempAmounts = new uint256[](amounts.length + 1);
//         for (uint256 i = 0; i < seasons.length; i++) {
//             tempSeasons[i] = seasons[i];
//             tempAmounts[i] = amounts[i];
//         }
//         tempSeasons[tempSeasons.length - 1] = depositedSiloSeason;
//         tempAmounts[tempAmounts.length - 1] = depositedSiloAmount;

//         convertAndUpdate(tempSeasons, tempAmounts, assets + depositedSiloAmount);

//         // Mint
//         _mint(receiver, shares);
//         emit Deposit(caller, receiver, assets, shares);
//     }

//     /**
//      * @dev Withdraw/redeem common workflow.
//      */
//     function _withdraw(
//         address caller,
//         address receiver,
//         address owner,
//         uint256 assets,
//         uint256 shares
//     ) internal virtual {
//         if (caller != owner) {
//             _spendAllowance(owner, caller, shares);
//         }
//         _burn(owner, shares);
//         depositedSiloAmount -= uint216(assets);
//         IBeanstalk(BEANSTALK_ADDRESS).transferDeposit(
//             address(this),
//             receiver,
//             siloTokenAddress,
//             depositedSiloSeason,
//             assets
//         );

//         emit Withdraw(caller, receiver, owner, assets, shares);
//     }

//     function _isVaultCollateralized() private view returns (bool) {
//         return totalAssets() > 0 || totalSupply() == 0;
//     }
// }
