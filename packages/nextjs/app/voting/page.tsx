"use client";

import { useEffect, useState } from "react";
import { CreateProposalForm } from "./_components/CreateProposalForm";
import { ProposalCard } from "./_components/ProposalCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const VotingPage = () => {
  const [activeTab, setActiveTab] = useState<"proposals" | "create">("proposals");
  const [nextProposalId, setNextProposalId] = useState<bigint>(1n);

  const { data: nextId } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "nextProposalId",
  });

  useEffect(() => {
    if (nextId) {
      setNextProposalId(nextId);
    }
  }, [nextId]);

  const proposalIds = Array.from({ length: Number(nextProposalId) - 1 }, (_, i) => BigInt(i + 1));

  return (
    <div className="flex flex-col gap-6 py-8 px-4 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-base-content">Голосование</h1>
        <p className="opacity-60 mt-2">Создавайте голосования и добавляйте избирателей</p>
      </div>

      <div className="flex gap-2 justify-center">
        <button
          className={`btn ${activeTab === "proposals" ? "btn-primary shadow-lg shadow-primary/20" : "btn-ghost"}`}
          onClick={() => setActiveTab("proposals")}
        >
          Голосования
        </button>
        <button
          className={`btn ${activeTab === "create" ? "btn-primary shadow-lg shadow-primary/20" : "btn-ghost"}`}
          onClick={() => setActiveTab("create")}
        >
          Создать
        </button>
      </div>

      {activeTab === "create" && <CreateProposalForm />}

      {activeTab === "proposals" && (
        <div className="flex flex-col gap-4">
          {proposalIds.length === 0 ? (
            <div className="text-center py-16 bg-base-200 rounded-2xl border border-base-300">
              <div className="text-6xl mb-4 opacity-30">🗳️</div>
              <p className="text-xl opacity-50">Пока нет голосований</p>
              <p className="opacity-40 mt-2">Создайте первое голосование!</p>
            </div>
          ) : (
            [...proposalIds].reverse().map(id => <ProposalCard key={id.toString()} proposalId={id} />)
          )}
        </div>
      )}
    </div>
  );
};

export default VotingPage;
