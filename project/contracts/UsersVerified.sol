// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title UsersVerified
 * @dev Store verified users
 */
contract UsersVerified {
    // Nested mapping to store data
    mapping(address => bool) private verifiedUsers;
    uint256 private pendingUsersCount;
    mapping(uint256 => address) private pendingUsers;

    // Owner of the contract
    address private owner;

    event Verified(address user);
    event AddedPetition(address user, uint256 index);
    event Removed(address user);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Modifier to restrict access to the owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    /**
     * @dev Constructor to set the initial owner
     */
    constructor() {
        owner = msg.sender;
        pendingUsersCount = 0;
        emit OwnershipTransferred(address(0), owner);
    }

    /**
     * @dev Get the current owner of the contract
     * @return The address of the owner
     */
    function getOwner() public view returns (address) {
        return owner;
    }

    /**
     * @dev Allows the current owner to transfer ownership to a new address
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function addUser(address user) onlyOwner public {
        require(!verifiedUsers[user], "User is already verified");
        verifiedUsers[user] = true;
        emit Verified(user);
    }
    function removeUser(address user) onlyOwner public {
        require(verifiedUsers[user], "User is not verified");
        verifiedUsers[user] = false;
        emit Removed(user);
    }
    function addPetition(address user) public returns (uint256) {
        require(!verifiedUsers[user], "User is already verified");
        pendingUsers[pendingUsersCount] = user;
        emit AddedPetition(user, pendingUsersCount);
        pendingUsersCount++;
        return pendingUsersCount-1;
    }
    function getPendingUsersCount() public view returns (uint256) {
        return pendingUsersCount;
    }
    function getPendingUser(uint256 index) public view returns (address) {
        return pendingUsers[index];
    }
    function isVerified(address user) public view returns (bool) {
        return verifiedUsers[user];
    }
}