// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    enum Phase {
        Registration,
        Voting,
        Finalized
    }

    struct Proposal {
        uint256 id;
        string title;
        address admin;
        Phase phase;
        uint256 startTime;
        uint256 registrationDeadline;
        uint256 votingDeadline;
        uint256 depositRequired;
        uint256 totalVotes;
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    uint256 public nextProposalId = 1;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => uint256) public candidateCount;
    mapping(uint256 => mapping(address => bytes32)) public commitments;
    mapping(uint256 => mapping(address => uint256)) public deposits;
    mapping(uint256 => mapping(address => bool)) public revealed;
    mapping(uint256 => mapping(address => bool)) public isVoter;

    event ProposalCreated(uint256 indexed proposalId, string title, address admin);
    event CandidateAdded(uint256 indexed proposalId, uint256 candidateId, string name);
    event VoterRegistered(uint256 indexed proposalId, address voter);
    event VoterRevoked(uint256 indexed proposalId, address voter);
    event AdminChanged(uint256 indexed proposalId, address newAdmin);
    event CommitMade(uint256 indexed proposalId, address indexed voter, bytes32 commitHash);
    event VoteRevealed(uint256 indexed proposalId, address indexed voter, uint256 candidateId);
    event VoterSlashed(uint256 indexed proposalId, address indexed voter, uint256 penalty);
    event ProposalFinalized(uint256 indexed proposalId, uint256 winnerId);
    event PhaseAdvanced(uint256 indexed proposalId, Phase newPhase);

    function createProposal(
        string memory _title,
        uint256 _registrationDuration,
        uint256 _votingDuration,
        uint256 _depositRequired
    ) external {
        uint256 proposalId = nextProposalId++;
        uint256 registrationDeadline = block.timestamp + _registrationDuration;
        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            admin: msg.sender,
            phase: Phase.Registration,
            startTime: block.timestamp,
            registrationDeadline: registrationDeadline,
            votingDeadline: registrationDeadline + _votingDuration,
            depositRequired: _depositRequired,
            totalVotes: 0
        });
        emit ProposalCreated(proposalId, _title, msg.sender);
    }

    modifier onlyProposalAdmin(uint256 _proposalId) {
        require(proposals[_proposalId].admin == msg.sender, "Not admin");
        _;
    }

    function _autoAdvancePhase(Proposal storage p) internal {
        if (p.phase == Phase.Registration && block.timestamp > p.registrationDeadline) {
            p.phase = Phase.Voting;
            emit PhaseAdvanced(p.id, Phase.Voting);
        }
    }

    function advancePhase(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        _autoAdvancePhase(p);
    }

    function changeAdmin(uint256 _proposalId, address _newAdmin) external onlyProposalAdmin(_proposalId) {
        proposals[_proposalId].admin = _newAdmin;
        emit AdminChanged(_proposalId, _newAdmin);
    }

    function registerVoter(uint256 _proposalId, address _voter) external onlyProposalAdmin(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        _autoAdvancePhase(p);
        require(p.phase == Phase.Registration, "Not in registration phase");
        require(!isVoter[_proposalId][_voter], "Already registered");
        isVoter[_proposalId][_voter] = true;
        emit VoterRegistered(_proposalId, _voter);
    }

    function registerVoters(uint256 _proposalId, address[] calldata _voters) external onlyProposalAdmin(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        _autoAdvancePhase(p);
        require(p.phase == Phase.Registration, "Not in registration phase");
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!isVoter[_proposalId][_voters[i]]) {
                isVoter[_proposalId][_voters[i]] = true;
                emit VoterRegistered(_proposalId, _voters[i]);
            }
        }
    }

    function revokeVoter(uint256 _proposalId, address _voter) external onlyProposalAdmin(_proposalId) {
        require(isVoter[_proposalId][_voter], "Not registered");
        isVoter[_proposalId][_voter] = false;
        emit VoterRevoked(_proposalId, _voter);
    }

    function addCandidate(uint256 _proposalId, string memory _name) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        _autoAdvancePhase(p);
        require(p.phase == Phase.Registration || p.phase == Phase.Voting, "Cannot add candidates");
        uint256 candidateId = candidateCount[_proposalId] + 1;
        candidates[_proposalId][candidateId] = Candidate({ id: candidateId, name: _name, voteCount: 0 });
        candidateCount[_proposalId] = candidateId;
        emit CandidateAdded(_proposalId, candidateId, _name);
    }

    function commit(uint256 _proposalId, bytes32 _commitHash) external payable {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        _autoAdvancePhase(p);
        require(p.phase == Phase.Voting, "Not in voting phase");
        require(block.timestamp <= p.votingDeadline, "Voting deadline passed");
        require(isVoter[_proposalId][msg.sender], "Not registered voter");
        require(commitments[_proposalId][msg.sender] == bytes32(0), "Already committed");
        require(msg.value >= p.depositRequired, "Insufficient deposit");

        commitments[_proposalId][msg.sender] = _commitHash;
        deposits[_proposalId][msg.sender] = msg.value;
        emit CommitMade(_proposalId, msg.sender, _commitHash);
    }

    function reveal(uint256 _proposalId, uint256 _candidateId, bytes32 _salt) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        require(p.phase == Phase.Voting || p.phase == Phase.Finalized, "Not revealable");
        require(!revealed[_proposalId][msg.sender], "Already revealed");
        require(commitments[_proposalId][msg.sender] != bytes32(0), "No commit found");

        bytes32 computedHash = keccak256(abi.encodePacked(_candidateId, _salt));
        require(commitments[_proposalId][msg.sender] == computedHash, "Invalid reveal");

        revealed[_proposalId][msg.sender] = true;
        uint256 deposit = deposits[_proposalId][msg.sender];
        deposits[_proposalId][msg.sender] = 0;

        require(candidates[_proposalId][_candidateId].id != 0, "Invalid candidate");
        candidates[_proposalId][_candidateId].voteCount++;
        p.totalVotes++;

        payable(msg.sender).transfer(deposit);
        emit VoteRevealed(_proposalId, msg.sender, _candidateId);
    }

    function slashNoReveal(uint256 _proposalId, address _voter) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        require(p.phase == Phase.Finalized, "Not finalized");
        require(commitments[_proposalId][_voter] != bytes32(0), "No commitment found");
        require(!revealed[_proposalId][_voter], "Already revealed");
        require(deposits[_proposalId][_voter] > 0, "Already slashed");

        uint256 penalty = deposits[_proposalId][_voter];
        deposits[_proposalId][_voter] = 0;
        emit VoterSlashed(_proposalId, _voter, penalty);
    }

    function finalizeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Proposal not found");
        require(p.phase == Phase.Voting, "Not in voting phase");
        require(block.timestamp > p.votingDeadline, "Voting not ended");

        p.phase = Phase.Finalized;

        uint256 winnerId = 0;
        uint256 maxVotes = 0;
        for (uint256 i = 1; i <= candidateCount[_proposalId]; i++) {
            if (candidates[_proposalId][i].voteCount > maxVotes) {
                maxVotes = candidates[_proposalId][i].voteCount;
                winnerId = i;
            }
        }
        emit ProposalFinalized(_proposalId, winnerId);
    }

    function getCandidates(uint256 _proposalId) external view returns (Candidate[] memory) {
        uint256 count = candidateCount[_proposalId];
        Candidate[] memory result = new Candidate[](count);
        for (uint256 i = 1; i <= count; i++) {
            result[i - 1] = candidates[_proposalId][i];
        }
        return result;
    }
}
