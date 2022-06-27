// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./TestToken.sol";
import "./MockOracle.sol";

contract CDP {
    struct Vault {
        uint256 collateral;
        uint256 debt;
    }

    uint256 private constant ratio = 75e16;

    mapping(address => Vault) vaults;
    address public token;
    address private oracle;

    constructor(address _oracle) {
        token = address(new Token("Stablecoin", "SS"));
        oracle = _oracle;
    }

    function deposit(uint256 amountToDeposit) external payable {
        require(amountToDeposit == msg.value, "incorrect ETH amount");
        uint256 amountToMint = estimateTokenAmount(amountToDeposit);
        Token(token).mint(msg.sender, amountToMint);
        vaults[msg.sender].collateral += amountToDeposit;
        vaults[msg.sender].debt += amountToMint;
    }

    function withdraw(uint256 repaymentAmount) external {
        require(
            repaymentAmount <= vaults[msg.sender].debt,
            "withdraw limit exceeded"
        );
        uint256 amountToWithdraw = repaymentAmount / getEthUSDPrice();
        Token(token).burn(msg.sender, repaymentAmount);
        vaults[msg.sender].collateral -= amountToWithdraw;
        vaults[msg.sender].debt -= repaymentAmount;
        payable(msg.sender).transfer(amountToWithdraw);
    }

    function getVault(address userAddress)
        external
        view
        returns (Vault memory vault)
    {
        return vaults[userAddress];
    }

    function estimateCollateralAmount(uint256 repaymentAmount, address user)
        external
        view
        returns (uint256 collateralAmount)
    {
        uint256 collateral = vaults[user].collateral;
        uint256 calculated = (((repaymentAmount * 1e18) / getEthUSDPrice()) *
            1e18) / ratio;
        return calculated > collateral ? collateral : calculated;
    }

    function estimateTokenAmount(uint256 depositAmount)
        public
        view
        returns (uint256 tokenAmount)
    {
        tokenAmount =
            ((depositAmount * getEthUSDPrice()) * ratio) /
            1e18 /
            1e18;
    }

    function getEthUSDPrice() public view returns (uint256) {
        return MockOracle(oracle).getLatestPrice();
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.13;

contract MockOracle {
    uint256 private price;

    constructor() {
        price = 4058077724920000000000;
    }

    function getLatestPrice() public view returns (uint256) {
        return price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }
}
