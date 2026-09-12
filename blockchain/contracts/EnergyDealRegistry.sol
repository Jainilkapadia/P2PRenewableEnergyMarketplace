// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EnergyDealRegistry
 * @dev Immutable on-chain anchor registry for cryptographically verified P2P renewable energy trades.
 * 
 * Scaled Quantities:
 * - Energy amounts are scaled by SCALE_FACTOR (100). Example: 25.50 kWh -> 2550
 * - Total amounts (INR) are scaled by SCALE_FACTOR (100). Example: 145.00 INR -> 14500
 * 
 * Privacy & Security:
 * - Database UUIDs of individual buyers/sellers are kept off-chain to maintain privacy.
 * - Authoritative trade UUID and verification reference link this immutable record to off-chain audit trail.
 * - The canonical SHA-256 hash provides tamper detection: any alteration of off-chain trade payload
 *   will produce a different hash that will fail verifyDealHash().
 */
contract EnergyDealRegistry {
    /// @dev Deterministic scaling factor for 2 decimal places (kWh and INR currency amounts)
    uint256 public constant SCALE_FACTOR = 100;

    /// @dev Data structure representing an anchored energy deal
    struct EnergyDeal {
        string tradeId;
        string verificationReference;
        bytes32 tradeCanonicalHash;
        uint256 energyAmountKwhScaled;
        uint256 totalAmountScaled;
        uint256 anchoredAt;
        address anchoredBy;
    }

    /// @dev Mapping from tradeId to anchored EnergyDeal
    mapping(string => EnergyDeal) private _deals;

    /// @dev Mapping to track deal registration status for duplicate protection
    mapping(string => bool) private _isRegistered;

    /// @dev Total number of deals anchored in this registry
    uint256 public totalDealsCount;

    /// @dev Emitted when a new energy deal is successfully anchored on-chain
    event DealAnchored(
        string indexed tradeId,
        string verificationReference,
        bytes32 indexed tradeCanonicalHash,
        uint256 energyAmountKwhScaled,
        uint256 totalAmountScaled,
        uint256 timestamp,
        address indexed anchoredBy
    );

    /**
     * @notice Anchors an already-verified P2P energy trade on-chain.
     * @dev Reverts if the tradeId has already been registered or if inputs are invalid.
     * @param tradeId The unique UUID string of the trade from the marketplace backend.
     * @param verificationReference Public verification reference code (e.g., P2P-VRF-...).
     * @param tradeCanonicalHash The 32-byte SHA-256 hash of the canonical trade payload.
     * @param energyAmountKwhScaled Energy quantity in kWh scaled by 100 (e.g., 2550 for 25.50 kWh).
     * @param totalAmountScaled Total trade value scaled by 100 (e.g., 14500 for 145.00 INR).
     * @return success True if the deal was successfully anchored.
     */
    function registerDeal(
        string calldata tradeId,
        string calldata verificationReference,
        bytes32 tradeCanonicalHash,
        uint256 energyAmountKwhScaled,
        uint256 totalAmountScaled
    ) external returns (bool) {
        require(bytes(tradeId).length > 0, "EnergyDealRegistry: Invalid empty tradeId");
        require(bytes(verificationReference).length > 0, "EnergyDealRegistry: Invalid empty verificationReference");
        require(tradeCanonicalHash != bytes32(0), "EnergyDealRegistry: Invalid zero hash");
        require(energyAmountKwhScaled > 0, "EnergyDealRegistry: Energy amount must be greater than zero");
        require(!_isRegistered[tradeId], "EnergyDealRegistry: Trade already registered");

        _deals[tradeId] = EnergyDeal({
            tradeId: tradeId,
            verificationReference: verificationReference,
            tradeCanonicalHash: tradeCanonicalHash,
            energyAmountKwhScaled: energyAmountKwhScaled,
            totalAmountScaled: totalAmountScaled,
            anchoredAt: block.timestamp,
            anchoredBy: msg.sender
        });

        _isRegistered[tradeId] = true;
        totalDealsCount += 1;

        emit DealAnchored(
            tradeId,
            verificationReference,
            tradeCanonicalHash,
            energyAmountKwhScaled,
            totalAmountScaled,
            block.timestamp,
            msg.sender
        );

        return true;
    }

    /**
     * @notice Retrieves the anchored energy deal details by tradeId.
     * @dev Reverts if the trade has not been registered.
     * @param tradeId The unique UUID string of the trade.
     * @return The EnergyDeal struct containing all on-chain metadata.
     */
    function getDeal(string calldata tradeId) external view returns (EnergyDeal memory) {
        require(_isRegistered[tradeId], "EnergyDealRegistry: Trade not found");
        return _deals[tradeId];
    }

    /**
     * @notice Checks whether a trade has already been anchored on-chain.
     * @param tradeId The unique UUID string of the trade.
     * @return True if registered, false otherwise.
     */
    function isDealRegistered(string calldata tradeId) external view returns (bool) {
        return _isRegistered[tradeId];
    }

    /**
     * @notice Verifies whether a supplied canonical hash matches the anchored hash for a given tradeId.
     * @dev Core function for tamper detection demonstration.
     * @param tradeId The unique UUID string of the trade.
     * @param tradeCanonicalHash The SHA-256 hash to verify against the on-chain anchor.
     * @return True if the trade is registered and the hashes match exactly; false otherwise.
     */
    function verifyDealHash(
        string calldata tradeId,
        bytes32 tradeCanonicalHash
    ) external view returns (bool) {
        if (!_isRegistered[tradeId]) {
            return false;
        }
        return _deals[tradeId].tradeCanonicalHash == tradeCanonicalHash;
    }
}
