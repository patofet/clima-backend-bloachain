// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SolarOwnership {
    address public owner;
    uint256 public totalPercentage = 0; // Total assigned percentage
    mapping(address => uint256) public ownership; // Wallet => Percentage

    // Events
    event OwnershipAssigned(address indexed user, uint256 percentage);
    event OwnershipTransferred(address indexed from, address indexed to, uint256 percentage);

    // Constructor: Set contract deployer as the owner
    constructor() {
        owner = msg.sender;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    modifier onlyValidPercentage(uint256 percentage) {
        require(percentage > 0, "Percentage must be greater than 0");
        require(percentage <= 100, "Percentage cannot exceed 100");
        _;
    }

    modifier onlyAvailablePercentage(uint256 percentage) {
        require(totalPercentage + percentage <= 100, "Not enough percentage available");
        _;
    }

    // Assign a new user ownership percentage (only owner can do this)
    function assignOwnership(address user, uint256 percentage)
    public
    onlyOwner
    onlyValidPercentage(percentage)
    onlyAvailablePercentage(percentage)
    {
        ownership[user] += percentage;
        totalPercentage += percentage;

        emit OwnershipAssigned(user, percentage);
    }

    // Transfer ownership percentage from one user to another
    function transferOwnership(address to, uint256 percentage)
    public
    onlyValidPercentage(percentage)
    {
        require(ownership[msg.sender] >= percentage, "Insufficient percentage to transfer");

        ownership[msg.sender] -= percentage;
        ownership[to] += percentage;

        emit OwnershipTransferred(msg.sender, to, percentage);
    }

    // Owner can transfer ownership on behalf of any user
    function transferOwnershipByOwner(
        address from,
        address to,
        uint256 percentage
    ) public onlyOwner onlyValidPercentage(percentage) {
        require(ownership[from] >= percentage, "User does not have enough percentage");

        ownership[from] -= percentage;
        ownership[to] += percentage;

        emit OwnershipTransferred(from, to, percentage);
    }

    // Check the percentage of a specific user
    function getUserPercentage(address user) public view returns (uint256) {
        return ownership[user];
    }

    // Get the remaining unassigned percentage
    function getAvailablePercentage() public view returns (uint256) {
        return 100 - totalPercentage;
    }
}
