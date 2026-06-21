"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type AdminPanelProps = {
  proposalId: bigint;
};

export const AdminPanel = ({ proposalId }: AdminPanelProps) => {
  const { address } = useAccount();
  const [voterAddress, setVoterAddress] = useState("");
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const { data: proposal } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "proposals",
    args: [proposalId],
  });

  const { data: isVoter } = useScaffoldReadContract({
    contractName: "Voting",
    functionName: "isVoter",
    args: [proposalId, voterAddress || undefined],
  });

  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "Voting",
  });

  const isAdmin = proposal && address && proposal[2].toLowerCase() === address.toLowerCase();
  const phase = proposal ? ["Registration", "Commit", "Reveal", "Finalized"][Number(proposal[3])] : "Loading";

  const handleRegisterVoter = async () => {
    if (!voterAddress || voterAddress.length !== 42) {
      notification.error("Введите корректный адрес кошелька (0x...)");
      return;
    }
    try {
      setIsWorking(true);
      await writeContractAsync({
        functionName: "registerVoter",
        args: [proposalId, voterAddress as `0x${string}`],
      });
      notification.success("Избиратель добавлен!");
      setVoterAddress("");
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка");
    } finally {
      setIsWorking(false);
    }
  };

  const handleRevokeVoter = async () => {
    if (!voterAddress || voterAddress.length !== 42) {
      notification.error("Введите адрес кошелька");
      return;
    }
    try {
      setIsWorking(true);
      await writeContractAsync({
        functionName: "revokeVoter",
        args: [proposalId, voterAddress as `0x${string}`],
      });
      notification.success("Избиратель удалён!");
      setVoterAddress("");
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка");
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangeAdmin = async () => {
    if (!newAdminAddress || newAdminAddress.length !== 42) {
      notification.error("Введите корректный адрес кошелька");
      return;
    }
    try {
      setIsWorking(true);
      await writeContractAsync({
        functionName: "changeAdmin",
        args: [proposalId, newAdminAddress as `0x${string}`],
      });
      notification.success("Администратор изменён!");
      setNewAdminAddress("");
    } catch (error: any) {
      notification.error(error?.shortMessage || "Ошибка");
    } finally {
      setIsWorking(false);
    }
  };

  if (!proposal) {
    return <div className="skeleton h-32 w-full"></div>;
  }

  if (!isAdmin) {
    return (
      <div className="bg-base-100 border border-base-300 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-2">Панель администратора</h2>
        <div className="alert alert-warning">
          <span>
            Только создатель этого голосования может управлять избирателями. Ваш адрес: {address?.slice(0, 10)}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-2">Панель администратора</h2>
      <div className="alert alert-success mb-4">
        <span>Вы создатель этого голосования. Фаза: {phase}</span>
      </div>

      {phase === "Registration" && (
        <div className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Добавить/удалить избирателя</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x... адрес кошелька"
                className="input input-bordered flex-1 font-mono text-sm"
                value={voterAddress}
                onChange={e => setVoterAddress(e.target.value)}
              />
            </div>
            {voterAddress && voterAddress.length === 42 && (
              <label className="label">
                <span className={`label-text-alt ${isVoter ? "text-success" : "text-warning"}`}>
                  {isVoter ? "Уже добавлен в это голосование" : "Не добавлен"}
                </span>
              </label>
            )}
            <div className="flex gap-2 mt-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRegisterVoter}
                disabled={isWorking || !voterAddress || voterAddress.length !== 42}
              >
                {isWorking ? <span className="loading loading-spinner loading-sm"></span> : "Добавить"}
              </button>
              <button
                className="btn btn-error btn-sm"
                onClick={handleRevokeVoter}
                disabled={isWorking || !voterAddress || voterAddress.length !== 42}
              >
                Удалить
              </button>
            </div>
          </div>

          <div className="divider">Смена администратора</div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Передать права другому кошельку</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x... новый администратор"
                className="input input-bordered flex-1 font-mono text-sm"
                value={newAdminAddress}
                onChange={e => setNewAdminAddress(e.target.value)}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleChangeAdmin}
                disabled={isWorking || !newAdminAddress || newAdminAddress.length !== 42}
              >
                Передать
              </button>
            </div>
          </div>
        </div>
      )}

      {phase !== "Registration" && (
        <div className="alert alert-info">
          <span>Регистрация завершена. Фаза: {phase}</span>
        </div>
      )}
    </div>
  );
};
