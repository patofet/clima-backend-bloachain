// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.7.0 <0.9.0;

/**
 * @title DoubleMappingStorageWithFlag
 * @dev Generic storage for nested key-value pairs with set/unset capability and access control
 */
contract DoubleMappingStorage {
    // Struct to hold value, creator, and a flag
    struct DataEntry {
        string value;
        address creator;
        bool isSet;
    }

    // Nested mapping to store data
    mapping(string => mapping(string => DataEntry)) private data;

    event Stored(string indexed primaryKey, string indexed secondaryKey, string value, address creator);
    event Removed(string indexed primaryKey, string indexed secondaryKey, address remover);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Store a value associated with two keys
     * @param primaryKey The primary key
     * @param secondaryKey The secondary key
     * @param value The value to store
     */
    function store(string memory primaryKey, string memory secondaryKey, string memory value) public {
        require(bytes(primaryKey).length > 0, "Primary key cannot be empty");
        require(bytes(secondaryKey).length > 0, "Secondary key cannot be empty");
        require(bytes(value).length > 0, "Value cannot be empty");

        // Check if the data already exists and restrict overwriting by a different creator
        if (data[primaryKey][secondaryKey].isSet) {
            require(
                data[primaryKey][secondaryKey].creator == msg.sender,
                "Only the creator can modify this entry"
            );
        }

        data[primaryKey][secondaryKey] = DataEntry(value, msg.sender, true);

        emit Stored(primaryKey, secondaryKey, value, msg.sender);
    }

    /**
     * @dev Retrieve a value associated with two keys
     * @param primaryKey The primary key
     * @param secondaryKey The secondary key
     * @return The value, creator, and whether it is set
     */
    function retrieve(string memory primaryKey, string memory secondaryKey)
    public
    view
    returns (string memory, address, bool)
    {
        DataEntry memory entry = data[primaryKey][secondaryKey];
        return (entry.value, entry.creator, entry.isSet);
    }

    /**
     * @dev Remove a value associated with two keys
     * @param primaryKey The primary key
     * @param secondaryKey The secondary key
     */
    function remove(string memory primaryKey, string memory secondaryKey) public {
        require(data[primaryKey][secondaryKey].isSet, "Entry does not exist");
        require(
            data[primaryKey][secondaryKey].creator == msg.sender,
            "Only the creator can remove this entry"
        );

        delete data[primaryKey][secondaryKey];
        emit Removed(primaryKey, secondaryKey, msg.sender);
    }

    /**
     * @dev Check if a value is set for two keys
     * @param primaryKey The primary key
     * @param secondaryKey The secondary key
     * @return True if the value is set, false otherwise
     */
    function isSet(string memory primaryKey, string memory secondaryKey) public view returns (bool) {
        return data[primaryKey][secondaryKey].isSet;
    }
}
