// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UsersVerified.sol";

contract CertificationVerificated {
    UsersVerified private usersVerified;

    struct Proof {
        string signature; // Firma proporcionada por el usuario autenticado
        string initialHash; // Hash de la cadena certificada
        uint256 timestamp; // Marca de tiempo en la que se generó la prueba
    }

    struct Certificate {
        address certifier; // Dirección del certificador (msg.sender)
        address requester; // Usuario autenticado que pidió la certificación
        Proof proof;       // Prueba de autenticación
        uint256 timestamp; // Marca de tiempo de la certificación
        string description; // Descripción de la certificación
    }

    mapping(string => Certificate) private certificates;

    event StringCertificateIssued(
        string indexed certifiedData,
        address indexed certifier,
        address indexed requester,
        uint256 timestamp,
        string description,
        string proofSignature,
        uint256 proofTimestamp
    );

    event StringCertificateRevoked(
        string indexed certifiedData,
        address indexed certifier,
        address indexed requester,
        uint256 timestamp
    );

    constructor(UsersVerified _addrUsersVerified) {
       usersVerified = _addrUsersVerified;
    }

    function certify(
        string memory certifiedData,
        string memory description,
        address requester,
        string memory initialHash,
        string memory proofSignature,
        uint256 proofTimestamp
    ) public {
        require(certificates[certifiedData].timestamp == 0, "Esta cadena ya ha sido certificada.");
        require(usersVerified.isVerified(requester), "El solicitante no esta verificado.");
        require(proofTimestamp <= block.timestamp, "La marca de tiempo de la prueba no puede ser en el futuro.");
        require(proofTimestamp > 0, "La marca de tiempo de la prueba no puede ser 0.");
        require(proofTimestamp >= block.timestamp - 600, "La marca de tiempo de la prueba no puede ser mayor a 10 minutos.");

        certificates[certifiedData] = Certificate(
            msg.sender,       // Certificador
            requester,        // Solicitante
            Proof(proofSignature, initialHash, proofTimestamp), // Prueba de autenticación
            block.timestamp,  // Marca de tiempo
            description       // Descripción
        );
        
        emit StringCertificateIssued(
            certifiedData,
            msg.sender,
            requester,
            block.timestamp,
            description,
            proofSignature,
            proofTimestamp
        );
    }
    function isCertified(string memory certifiedString) public view returns (bool) {
        return certificates[certifiedString].timestamp != 0;
    }
    function getCertificateDetails(string memory certifiedData)
    public
    view
    returns (
        address certifier,
        address requester,
        string memory proofSignature,
        uint256 proofTimestamp,
        uint256 certTimestamp,
        string memory description
    )
    {
        require(certificates[certifiedData].timestamp != 0, "Esta cadena no ha sido certificada.");
        Certificate memory cert = certificates[certifiedData];
        return (
            cert.certifier,
            cert.requester,
            cert.proof.signature,
            cert.proof.timestamp,
            cert.timestamp,
            cert.description
        );
    }
    function revokeCertificate(string memory certifiedString) public {
        require(certificates[certifiedString].timestamp != 0, "Esta cadena no ha sido certificada.");
        require(certificates[certifiedString].certifier == msg.sender || certificates[certifiedString].requester == msg.sender, "No tienes permiso para revocar.");

        Certificate memory cert = certificates[certifiedString];

        // Elimina la certificación
        delete certificates[certifiedString];

        emit StringCertificateRevoked(certifiedString, cert.certifier, cert.requester, block.timestamp);
    }
}
