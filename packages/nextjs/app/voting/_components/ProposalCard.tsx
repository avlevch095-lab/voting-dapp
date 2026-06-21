"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "./AdminPanel";
import { encodePacked, formatEther, keccak256, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type ProposalProps = {
  proposalId: bigint;
};

const PHASES_RU = ["Регистрация", "Голосование", "Результаты"];

function generateSalt(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function computeCommitHash(candidateId: bigint, saltHex: string): `0x${string}` {
  const saltBytes = ("0x" + saltHex) as `0x${string}`;
  return keccak256(encodePacked(["uint256", "bytes32"], [candidateId, saltBytes]));
}

function getVoteData(proposalId: bigint, address: string | undefined) {
  if (!address) return null;
  const key = `vote_${proposalId}_${address}`;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function setVoteData(proposalId: bigint, address: string, candidateId: number, salt: string) {
  const key = `vote_${proposalId}_${address}`;
  localStorage.setItem(key, JSON.stringify({ candidateId, salt }));
}

export const ProposalCard = ({ proposalId }: ProposalProps) => {
  const { address } = useAccount();
  const [selectedCandidate, setSelectedCandidate] = useState<bigint>(0n);
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [now, setNow] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [autoRevealDone, setAutoRevealDone] = useState(false);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: proposal, error: proposalError } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "proposals",
    args: [proposalId],
  });

  const { data: candidates } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "getCandidates",
    args: [proposalId],
  });

  const { data: hasCommitted } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "commitments",
    args: [proposalId, address],
  });

  const { data: hasRevealed } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "revealed",
    args: [proposalId, address],
  });

  const { data: isVoter } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "isVoter",
    args: [proposalId, address],
  });

  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "Voting",
  });

  const committed = hasCommitted && hasCommitted !== "0x" + "0".repeat(64);
  const revealed = !!hasRevealed;

  // Auto-reveal when voting ends
  useEffect(() => {
    if (!proposal || !address || !committed || revealed || autoRevealDone || isRevealing) return;

    const phaseNum = Number(proposal[3]);
    const votingDeadline = Number(proposal[5]);

    if (phaseNum !== 1 || now <= votingDeadline) return;

    const vd = getVoteData(proposalId, address);
    if (!vd) return;

    setAutoRevealDone(true);

    (async () => {
      try {
        setIsRevealing(true);
        // Mine a block to advance blockchain time
        try {
          await writeContractAsync({
            functionName: "advancePhase",
            args: [proposalId],
          });
        } catch {
          // Ignore
        }
        const saltBytes = ("0x" + vd.salt) as `0x${string}`;
        await writeContractAsync({
          functionName: "reveal",
          args: [proposalId, BigInt(vd.candidateId), saltBytes],
        });
        notification.success("Голос раскрыт автоматически!");
      } catch (error: any) {
        notification.error(error?.shortMessage || "Ошибка раскрытия");
      } finally {
        setIsRevealing(false);
      }
    })();
  }, [proposal, address, committed, revealed, autoRevealDone, isRevealing, proposalId, writeContractAsync, now]);

  const handleAdvancePhase = async () => {
    try {
      setIsAdvancing(true);
      await writeContractAsync({
        functionName: "advancePhase",
        args: [proposalId],
      });
      notification.success("Фаза переключена!");
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка");
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setIsFinalizing(true);
      // Mine a block to advance blockchain time before finalizing
      try {
        await writeContractAsync({
          functionName: "advancePhase",
          args: [proposalId],
        });
      } catch {
        // Ignore — advancePhase may revert if already advanced, that's fine
      }
      await writeContractAsync({
        functionName: "finalizeProposal",
        args: [proposalId],
      });
      notification.success("Результаты подсчитаны!");
    } catch (error: any) {
      if (error?.shortMessage?.includes("Voting not ended")) {
        notification.error("Подождите ещё немного и попробуйте снова");
      } else {
        notification.error(error?.shortMessage || "Ошибка");
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCommit = async () => {
    if (selectedCandidate === 0n) {
      notification.error("Выберите кандидата");
      return;
    }
    try {
      setIsCommitting(true);
      const salt = generateSalt();
      const hash = computeCommitHash(selectedCandidate, salt);

      await writeContractAsync({
        functionName: "commit",
        args: [proposalId, hash],
        value: parseEther(depositAmount),
      });

      if (address) {
        setVoteData(proposalId, address, Number(selectedCandidate), salt);
      }

      notification.success("Голос зафиксирован!");
      setSelectedCandidate(0n);
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка");
    } finally {
      setIsCommitting(false);
    }
  };

  if (proposalError) {
    return (
      <div className="bg-base-100 border border-error rounded-xl p-6">
        <p className="text-error">Ошибка загрузки голосования #{proposalId.toString()}</p>
        <p className="text-sm text-base-content/70">Убедитесь, что Hardhat запущен</p>
      </div>
    );
  }

  if (!proposal) {
    return <div className="skeleton h-48 w-full"></div>;
  }

  const phaseNum = Number(proposal[3]);
  const phase = PHASES_RU[phaseNum];
  const adminAddress = proposal[2] as string;
  const regDeadline = Number(proposal[5]);
  const votingDeadline = Number(proposal[6]);

  const regSecsLeft = now > 0 ? Math.max(0, regDeadline - now) : 0;
  const votingSecsLeft = now > 0 ? Math.max(0, votingDeadline - now) : 0;

  const regEnded = now >= regDeadline;
  const votingEnded = now >= votingDeadline;

  const badgeClass = phaseNum === 0 ? "badge-info" : phaseNum === 1 ? "badge-primary" : "badge-success";

  const isCreator = address && adminAddress.toLowerCase() === address.toLowerCase();

  const formatTime = (secs: number) => {
    if (secs <= 0) return "истёк";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}м ${s}с` : `${s}с`;
  };

  return (
    <div className="card bg-base-100 shadow-lg border border-base-300">
      <div className="card-body p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="card-title text-lg">{proposal[1]}</h3>
            <div className="flex gap-3 mt-1 text-xs opacity-60">
              <span>ID: {proposalId.toString()}</span>
              <span>
                Админ: {adminAddress.slice(0, 6)}...{adminAddress.slice(-4)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {isCreator && phaseNum === 0 && !showAdmin && (
              <button className="btn btn-xs btn-ghost" onClick={() => setShowAdmin(true)}>
                Настройки
              </button>
            )}
            <div className={`badge ${badgeClass} badge-lg shadow-sm`}>{phase}</div>
          </div>
        </div>

        {showAdmin && isCreator && phaseNum === 0 && (
          <div className="mb-4">
            <AdminPanel proposalId={proposalId} />
          </div>
        )}

        {phaseNum === 0 && (
          <div className="alert alert-info shadow-sm mb-4">
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center">
                <span>{isCreator ? "Добавьте избирателей" : "Ожидание начала голосования"}</span>
                {regSecsLeft > 0 && <span className="badge badge-ghost font-mono">{formatTime(regSecsLeft)}</span>}
              </div>
              {isCreator && regEnded && (
                <button
                  className="btn btn-primary btn-sm mt-3 shadow-md shadow-primary/20"
                  onClick={handleAdvancePhase}
                  disabled={isAdvancing}
                >
                  {isAdvancing ? <span className="loading loading-spinner loading-sm"></span> : "Начать голосование"}
                </button>
              )}
              {isCreator && !regEnded && (
                <span className="text-xs text-base-content/60 mt-2">Кнопка появится когда регистрация завершится</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/70">Депозит</p>
            <p className="font-bold text-sm">{formatEther(proposal[7])} ETH</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/70">Голосов</p>
            <p className="font-bold text-sm">{proposal[8].toString()}</p>
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-center">
            <p className="text-xs text-base-content/70">{phaseNum === 0 ? "Регистрация" : "Осталось"}</p>
            <p className="font-bold text-sm">
              {phaseNum === 0 ? formatTime(regSecsLeft) : phaseNum === 1 ? formatTime(votingSecsLeft) : "—"}
            </p>
          </div>
        </div>

        {candidates &&
          candidates.length > 0 &&
          (() => {
            const totalVotes = Number(proposal[8]);
            const maxVotes = candidates.reduce((max: number, c: any) => Math.max(max, Number(c.voteCount)), 0);
            const colors = ["bg-primary", "bg-secondary", "bg-accent", "bg-info", "bg-warning"];
            return (
              <div className="mb-4">
                <h4 className="font-bold text-sm mb-3 text-base-content/60">Кандидаты</h4>
                <div className="flex flex-col gap-3">
                  {candidates.map((c: any, i: number) => {
                    const votes = Number(c.voteCount);
                    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                    const isWinner = phaseNum === 2 && votes === maxVotes && votes > 0;
                    return (
                      <div key={i} className={`${isWinner ? "ring-2 ring-success rounded-lg p-2 -m-2" : ""}`}>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className={`font-medium ${isWinner ? "text-success" : ""}`}>
                            {isWinner && "🏆 "}
                            {c.name}
                          </span>
                          <span className="text-base-content/60">
                            {votes} голосов · <span className="font-mono">{pct}%</span>
                          </span>
                        </div>
                        <div className="w-full bg-base-200 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-4 rounded-full transition-all duration-700 ease-out ${colors[i % colors.length]} ${isWinner ? "shadow-sm" : "opacity-80"}`}
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {phaseNum === 1 && (
          <div className="border-t border-base-300 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-sm text-base-content/60">Голосование</h4>
              {isCreator && votingEnded && (
                <button
                  className="btn btn-success btn-sm shadow-md shadow-success/20"
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                >
                  {isFinalizing ? <span className="loading loading-spinner loading-sm"></span> : "Показать результаты"}
                </button>
              )}
            </div>

            {!address ? (
              <div className="alert alert-info shadow-sm">
                <span>Подключите кошелёк</span>
              </div>
            ) : !isVoter ? (
              <div className="alert alert-warning shadow-sm">
                <span>Вы не добавлены в избиратели</span>
              </div>
            ) : committed ? (
              <div className="alert alert-success shadow-sm">
                <span>Вы проголосовали!</span>
              </div>
            ) : votingEnded ? (
              <div className="alert alert-warning shadow-sm">
                <span>Время голосования вышло</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <select
                  className="select select-bordered w-full focus:select-primary"
                  value={selectedCandidate.toString()}
                  onChange={e => setSelectedCandidate(BigInt(e.target.value))}
                >
                  <option value="0">Выберите кандидата</option>
                  {candidates?.map((c: any, i: number) => (
                    <option key={i} value={c.id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="label py-0">
                      <span className="label-text text-xs">Депозит (ETH)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-full focus:input-primary"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      step="0.001"
                      min="0.001"
                    />
                  </div>
                  <button
                    className="btn btn-primary shadow-md shadow-primary/20"
                    onClick={handleCommit}
                    disabled={isCommitting || selectedCandidate === 0n}
                  >
                    {isCommitting ? <span className="loading loading-spinner loading-sm"></span> : "Проголосовать"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phaseNum === 2 && (
          <div className="alert alert-success shadow-sm mt-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Голосование завершено! Результаты подсчитаны.</span>
          </div>
        )}
      </div>
    </div>
  );
};
