import { expect } from "chai";
import { network } from "hardhat";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const computeCommitHash = (candidateId: number, salt: string) => {
  return ethers.keccak256(ethers.solidityPacked(["uint256", "bytes32"], [candidateId, ethers.id(salt)]));
};

async function deployFixture() {
  const env = await loadAndExecuteDeploymentsFromFiles({ provider });

  const votingAddress = env.get("Voting").address;
  const votingAbi = env.get("Voting").abi;

  const voting = await ethers.getContractAt(votingAbi, votingAddress);

  return { env, voting };
}

describe("Voting System", function () {
  let admin: any;
  let voter1: any;
  let voter2: any;
  let stranger: any;

  before(async function () {
    const signers = await ethers.getSigners();
    admin = signers[0];
    voter1 = signers[1];
    voter2 = signers[2];
    stranger = signers[3];
  });

  describe("Deployment", function () {
    it("Should initialize nextProposalId to 1", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      expect(await voting.nextProposalId()).to.equal(1);
    });
  });

  describe("Registration", function () {
    it("Should register voter for proposal", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 60, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      expect(await voting.isVoter(1, voter1.address)).to.be.true;
    });

    it("Should not allow non-admin to register", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 60, 60, ethers.parseEther("0.001"));
      await expect(voting.connect(stranger).registerVoter(1, voter1.address)).to.be.revertedWith("Not admin");
    });

    it("Should not allow unregistered to commit", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);

      await networkHelpers.time.increase(11);

      const hash = computeCommitHash(1, "salt");
      await expect(voting.connect(stranger).commit(1, hash, { value: ethers.parseEther("0.001") })).to.be.revertedWith(
        "Not registered voter",
      );
    });
  });

  describe("Commit phase", function () {
    it("Should accept valid commit", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).addCandidate(1, "Alice");

      await networkHelpers.time.increase(11);

      const hash = computeCommitHash(1, "salt1");
      await expect(voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.001") })).to.emit(
        voting,
        "CommitMade",
      );
    });

    it("Should not allow double commit", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).addCandidate(1, "Alice");

      await networkHelpers.time.increase(11);

      const hash = computeCommitHash(1, "salt1");
      await voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.001") });
      await expect(voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.001") })).to.be.revertedWith(
        "Already committed",
      );
    });

    it("Should reject insufficient deposit", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).addCandidate(1, "Alice");

      await networkHelpers.time.increase(11);

      const hash = computeCommitHash(1, "salt1");
      await expect(voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.0005") })).to.be.revertedWith(
        "Insufficient deposit",
      );
    });
  });

  describe("Reveal", function () {
    it("Should accept valid reveal", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).addCandidate(1, "Alice");

      await networkHelpers.time.increase(11);

      const salt = "salt1";
      const hash = computeCommitHash(1, salt);
      await voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.001") });

      await networkHelpers.time.increase(61);

      await expect(voting.connect(voter1).reveal(1, 1, ethers.id(salt))).to.emit(voting, "VoteRevealed");
    });

    it("Should reject reveal with wrong salt", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).addCandidate(1, "Alice");

      await networkHelpers.time.increase(11);

      const hash = computeCommitHash(1, "salt1");
      await voting.connect(voter1).commit(1, hash, { value: ethers.parseEther("0.001") });

      await networkHelpers.time.increase(61);

      await expect(voting.connect(voter1).reveal(1, 1, ethers.id("wrong"))).to.be.revertedWith("Invalid reveal");
    });
  });

  describe("Admin", function () {
    it("Should allow admin to change admin", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 60, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).changeAdmin(1, voter1.address);
      const proposal = await voting.proposals(1);
      expect(proposal.admin).to.equal(voter1.address);
    });

    it("Should not allow non-admin to change admin", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 60, 60, ethers.parseEther("0.001"));
      await expect(voting.connect(stranger).changeAdmin(1, voter1.address)).to.be.revertedWith("Not admin");
    });
  });

  describe("Finalization", function () {
    it("Should correctly count votes", async function () {
      const { voting } = await networkHelpers.loadFixture(deployFixture);
      await voting.connect(admin).createProposal("Test Vote", 10, 60, ethers.parseEther("0.001"));
      await voting.connect(admin).registerVoter(1, voter1.address);
      await voting.connect(admin).registerVoter(1, voter2.address);
      await voting.connect(admin).addCandidate(1, "Alice");
      await voting.connect(admin).addCandidate(1, "Bob");

      await networkHelpers.time.increase(11);

      const salt1 = "salt1";
      const hash1 = computeCommitHash(1, salt1);
      await voting.connect(voter1).commit(1, hash1, { value: ethers.parseEther("0.001") });

      const salt2 = "salt2";
      const hash2 = computeCommitHash(2, salt2);
      await voting.connect(voter2).commit(1, hash2, { value: ethers.parseEther("0.001") });

      await networkHelpers.time.increase(61);

      await voting.connect(voter1).reveal(1, 1, ethers.id(salt1));
      await voting.connect(voter2).reveal(1, 2, ethers.id(salt2));

      await networkHelpers.time.increase(1);

      await voting.connect(admin).finalizeProposal(1);

      const candidates = await voting.getCandidates(1);
      expect(candidates[0].voteCount).to.equal(1);
      expect(candidates[1].voteCount).to.equal(1);
    });
  });
});
