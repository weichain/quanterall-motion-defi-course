//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFT is ERC721, Ownable {
    using Strings for uint256;

    uint public constant MAX_MINT_AMOUNT = 3;

    bool public isRevealed;
    uint public totalSupply;
    string public baseUri;
    

    mapping(address => bool) public isWhitelisted;
    mapping(address => uint) public amountOfPurchased;

    constructor (
        string memory _name, 
        string memory _symbol,
        string memory _baseUri
    )
        ERC721(_name, _symbol)
    { 
        baseUri = _baseUri;
    }

    function mint(address _recipient, uint _tokenId) public { 
        require(isWhitelisted[_recipient], "Err: not whitelisted");
        require(amountOfPurchased[_recipient] < MAX_MINT_AMOUNT, "Err: exceed max mint amount");

        totalSupply += 1;
        amountOfPurchased[_recipient] += 1;
        
        _mint(_recipient, _tokenId);
    }

    function tokenURI(uint _tokenId) public view override returns(string memory) {
        if(!isRevealed) {
            return baseUri;
        }

        return string(
            abi.encodePacked(baseUri, "/", _tokenId, ".json")
        );
    }

    function addToWhitelist(address[] memory _addresses) public onlyOwner {
        for(uint i = 0; i < _addresses.length; i++) {
            address _address = _addresses[i];
            
            require(_address != address(0), "Err: 0x address provided");
            
            isWhitelisted[_address] = true;
        }
    }

    function removeFromWhitelist(address[] memory _addresses) public onlyOwner {
        for(uint i = 0; i < _addresses.length; i++) {
            address _address = _addresses[i];
            
            require(_address != address(0), "Err: 0x address provided");
            
            isWhitelisted[_address] = false;
        }
    }

    function setIsRevealed(bool _isRevealed) public onlyOwner {
        isRevealed = _isRevealed;
    }

    function setBaseUri(string memory _baseUri) public onlyOwner {
        baseUri = _baseUri;
    }
   
}