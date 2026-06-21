"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const CreateProposalForm = () => {
  const [title, setTitle] = useState("");
  const [registrationDuration, setRegistrationDuration] = useState(120);
  const [votingDuration, setVotingDuration] = useState(300);
  const [depositRequired, setDepositRequired] = useState("0.01");
  const [candidateNames, setCandidateNames] = useState<string[]>(["", ""]);
  const [isCreating, setIsCreating] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "Voting",
  });

  const { writeContractAsync: addCandidate } = useScaffoldWriteContract({
    contractName: "Voting",
  });

  const { data: nextProposalId } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "nextProposalId",
  });

  const updateCandidate = (index: number, value: string) => {
    const updated = [...candidateNames];
    updated[index] = value;
    setCandidateNames(updated);
  };

  const addCandidateField = () => setCandidateNames([...candidateNames, ""]);

  const removeCandidateField = (index: number) => {
    if (candidateNames.length > 2) {
      setCandidateNames(candidateNames.filter((_, i) => i !== index));
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      notification.error("Введите название голосования");
      return;
    }

    const validCandidates = candidateNames.filter(c => c.trim());
    if (validCandidates.length < 2) {
      notification.error("Добавьте минимум 2 кандидата");
      return;
    }

    try {
      setIsCreating(true);

      const newProposalId = nextProposalId ?? 1n;

      await writeContractAsync({
        functionName: "createProposal",
        args: [title, BigInt(registrationDuration), BigInt(votingDuration), parseEther(depositRequired)],
      });

      notification.success("Голосование создано! Добавляем кандидатов...");

      for (const name of validCandidates) {
        await addCandidate({
          functionName: "addCandidate",
          args: [newProposalId, name],
        });
      }

      notification.success("Голосование и кандидаты добавлены!");

      setTitle("");
      setCandidateNames(["", ""]);
      setRegistrationDuration(120);
      setVotingDuration(300);
      setDepositRequired("0.01");
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка при создании");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Новое голосование</h2>

      <div className="flex flex-col gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Название</span>
          </label>
          <input
            type="text"
            placeholder="Например: Выбор председателя"
            className="input input-bordered w-full"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Регистрация (сек)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={registrationDuration}
              onChange={e => setRegistrationDuration(Number(e.target.value))}
              min={30}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/70">~{Math.floor(registrationDuration / 60)} мин</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Голосование (сек)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={votingDuration}
              onChange={e => setVotingDuration(Number(e.target.value))}
              min={60}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/70">~{Math.floor(votingDuration / 60)} мин</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Депозит (ETH)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={depositRequired}
              onChange={e => setDepositRequired(e.target.value)}
              step="0.001"
              min="0.001"
            />
            <label className="label">
              <span className="label-text-alt text-base-content/70">Возвращается после раскрытия</span>
            </label>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Кандидаты (мин. 2)</span>
          </label>
          <div className="flex flex-col gap-2">
            {candidateNames.map((name, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Кандидат ${index + 1}`}
                  className="input input-bordered flex-1"
                  value={name}
                  onChange={e => updateCandidate(index, e.target.value)}
                />
                {candidateNames.length > 2 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeCandidateField(index)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addCandidateField}>
              + Добавить кандидата
            </button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? <span className="loading loading-spinner loading-sm"></span> : "Создать голосование"}
        </button>
      </div>
    </div>
  );
};
