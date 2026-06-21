import { deployScript, artifacts } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    const voting = await env.deploy("Voting", {
      account: deployer,
      artifact: artifacts.Voting,
      args: [],
    });
    console.log("Voting deployed to:", voting.address);
  },
  {
    tags: ["Voting"],
  },
);
