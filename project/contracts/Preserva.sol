// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ControlledERC20 is ERC20, Ownable {
    mapping(address => address) public controller;
    mapping(address => bool) public isControllerModeActive;

    event ControlDelegated(address indexed owner, address indexed delegate);
    event ControlReturned(address indexed owner, address indexed delegate);

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**uint8(decimals()));
    }

    modifier onlyControllerOrSelf(address tokenOwner) {
        require(
            (msg.sender == tokenOwner && !isControllerModeActive[tokenOwner]) || 
            (msg.sender == controller[tokenOwner] && isControllerModeActive[tokenOwner]), "No tienes control sobre estos tokens");
        _;
    }

    function delegateControl(address _delegate) external {
        require(_delegate != address(0), "La direccion delegada no puede ser la direccion cero");
        require(_delegate != msg.sender, "No puedes delegarte el control a ti mismo");
        require(!isControllerModeActive[msg.sender], "No puedes delegar la cuenta si ya esta delegada");
        controller[msg.sender] = _delegate;
        isControllerModeActive[msg.sender] = true;
        super.approve(_delegate, type(uint256).max);
        emit ControlDelegated(msg.sender, _delegate);
    }

    function returnControl(address addressDelegate) external onlyControllerOrSelf(addressDelegate) {
        require(isControllerModeActive[addressDelegate], "No puedes devolver el control si no esta delegado");
        delete controller[addressDelegate];
        isControllerModeActive[addressDelegate] = false;
        super._approve(addressDelegate, msg.sender, 0, true);
        emit ControlReturned(msg.sender, addressDelegate);
    }

    function transfer(address recipient, uint256 amount) public override onlyControllerOrSelf(msg.sender) returns (bool) {
        return super.transfer(recipient, amount); 
    }

    function approve(address spender, uint256 amount) public override onlyControllerOrSelf(msg.sender) returns (bool) {
        return super.approve(spender, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override onlyControllerOrSelf(sender) returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}