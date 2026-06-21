"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BoltIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center flex-col grow">
      <div className="hero min-h-[60vh] bg-gradient-to-b from-base-200 to-base-100">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-bold mb-2 text-base-content">Система Голосования</h1>
            <p className="text-lg opacity-70 mt-4 mb-8">
              Безопасное децентрализованное голосование с автоматическим подсчётом результатов
            </p>
            {mounted && connectedAddress && (
              <div className="flex justify-center mb-6">
                <div className="badge badge-outline badge-lg gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <Address address={connectedAddress} chain={targetNetwork} />
                </div>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <Link href="/voting" passHref>
                <button className="btn btn-primary btn-lg gap-2">
                  <HandRaisedIcon className="h-5 w-5" />
                  Перейти к голосованию
                </button>
              </Link>
              <Link href="/debug" passHref>
                <button className="btn btn-ghost btn-lg gap-2">
                  <BoltIcon className="h-5 w-5" />
                  Контракты
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-base-200 shadow-md border border-base-300">
          <div className="card-body items-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </div>
            <h3 className="card-title text-sm">Регистрация</h3>
            <p className="text-xs text-base-content/60">Админ добавляет избирателей в конкретное голосование</p>
          </div>
        </div>

        <div className="card bg-base-200 shadow-md border border-base-300">
          <div className="card-body items-center text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="card-title text-sm">Голосование</h3>
            <p className="text-xs text-base-content/60">Избиратели выбирают кандидата, голос фиксируется</p>
          </div>
        </div>

        <div className="card bg-base-200 shadow-md border border-base-300">
          <div className="card-body items-center text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="card-title text-sm">Результаты</h3>
            <p className="text-xs text-base-content/60">Автоматический подсчёт с процентным соотношением</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
