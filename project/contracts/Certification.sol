// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Certification {
    struct Certificate {
        address certifier;
        uint256 timestamp;
        string description;
    }
    mapping(bytes32 => Certificate) public certificates;
    mapping(string => Certificate) public stringCertificates;

    event CertificateIssued(bytes32 indexed hash, address indexed certifier, uint256 timestamp, string description);
    event StringCertificateIssued(string indexed certifiedString, address indexed certifier, uint256 timestamp, string description);

    function certify(bytes32 hash, string memory description) public {
        require(certificates[hash].timestamp == 0, "Este hash ya ha sido certificado.");
        certificates[hash] = Certificate(msg.sender, block.timestamp, description);
        emit CertificateIssued(hash, msg.sender, block.timestamp, description);
    }

    function certifyString(string memory certifiedString, string memory description) public {
        require(stringCertificates[certifiedString].timestamp == 0, "Esta cadena ya ha sido certificada.");
        stringCertificates[certifiedString] = Certificate(msg.sender, block.timestamp, description);
        emit StringCertificateIssued(certifiedString, msg.sender, block.timestamp, description);
    }

    function isCertified(bytes32 hash) public view returns (bool) {
        return certificates[hash].timestamp != 0;
    }

    function isStringCertified(string memory certifiedString) public view returns (bool) {
        return stringCertificates[certifiedString].timestamp != 0;
    }

    function getCertificateDetails(bytes32 hash) public view returns (address, uint256, string memory) {
        require(certificates[hash].timestamp != 0, "Este hash no ha sido certificado.");
        Certificate memory cert = certificates[hash];
        return (cert.certifier, cert.timestamp, cert.description);
    }

    function getStringCertificateDetails(string memory certifiedString) public view returns (address, uint256, string memory) {
        require(stringCertificates[certifiedString].timestamp != 0, "Esta cadena no ha sido certificada.");
        Certificate memory cert = stringCertificates[certifiedString];
        return (cert.certifier, cert.timestamp, cert.description);
    }
}
