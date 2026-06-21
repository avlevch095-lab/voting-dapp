# 🗳 Децентрализованная система голосования

Приватная децентрализованная платформа голосования на Ethereum, построенная на **Scaffold-ETH 2** с протоколом **Commit-Reveal**.

<img width="1122" height="641" alt="image" src="https://github.com/user-attachments/assets/e1ce8651-177a-4476-912c-80146307a579" />


## Возможности

- **Commit-Reveal** — голоса зашифрованы до фазы раскрытия, никто не видит чужие голоса
- **Депозитная защита** — избиратели вносят ETH; за нераскрытие — slash депозита
- **Регистрация per-proposal** — админ регистрирует избирателей для конкретного голосования
- **Auto-reveal** — голос раскрывается автоматически при наступлении фазы Reveal
- **Панель администратора** — управление избирателями и настройка голосования
- **Тесты** — полный набор Hardhat-тестов, покрывающих весь жизненный цикл

## Технологии

| Уровень | Стек |
|---------|------|
| Контракт | Solidity, Hardhat, rocketh |
| Фронтенд | Next.js (App Router), TypeScript, Tailwind + DaisyUI |
| Web3 | RainbowKit, Wagmi, Viem |
| UI-компоненты | `@scaffold-ui/components` |

## Быстрый старт

```bash
# Установка зависимостей
yarn install

# Запуск локальной блокчейн-сети (Hardhat node)
yarn chain

# Деплой контрактов (в отдельном терминале)
yarn deploy

# Запуск фронтенда
yarn start
```

Откройте [http://localhost:3000].

## Как это работает

Протокол проходит **6 фаз**:

| Фаза | Описание |
|------|----------|
| **Create** | Админ создаёт голосование с кандидатами, временными рамками и суммой депозита |
| **Register** | Админ регистрирует избирателей через панель управления |
| **Commit** | Избиратели отправляют `keccak256(candidateId, salt)` + ETH-депозит. Salt генерируется автоматически и сохраняется в localStorage |
| **Reveal** | Автоматически при наступлении дедлайна. Контракт проверяет хеш и возвращает депозит |
| **Finalize** | Подсчёт голосов, объявление победителя |
| **Slash** | Любой может вызвать `slashNoReveal` для сжигания депозитов нераскрывших голоса |

### Создание голосования

Админ заполняет форму: название, времена фаз, депозит и список кандидатов.

<img width="1122" height="1565" alt="image" src="https://github.com/user-attachments/assets/1c40104f-5128-4fd4-b78a-55ee387a7547" />


### Регистрация избирателей

После создания голосования админ добавляет адреса кошельков избирателей через панель управления.

<img width="912" height="1636" alt="image" src="https://github.com/user-attachments/assets/f50a4b92-8722-4125-b434-d55b496e8b29" />


### Голосование (Commit)

Избиратель выбирает кандидата, указывает депозит и отправляет транзакцию. Salt автоматически генерируется и сохраняется в браузере.

<img width="1122" height="1614" alt="image" src="https://github.com/user-attachments/assets/6cefdd6d-ca93-4fc5-bad3-b03b029f6efd" />


### Просмотр результатов

После завершения голосования отображаются результаты: голоса в виде прогресс-баров, победитель отмечен значком 🏆.

<img width="1072" height="1245" alt="image" src="https://github.com/user-attachments/assets/73ef9250-2dfe-45f7-a270-5209ffb49fb9" />


## Логика контракта

Контракт `Voting.sol` — единый контракт для управления голосованиями с протоколом Commit-Reveal.

**Структуры:** `Proposal` (голосование с фазами, дедлайнами, депозитом) и `Candidate` (кандидат со счётчиком голосов). **Маппинги:** хранят голосования, кандидатов, хеши commit, депозиты, флаги revealed/isVoter.

**Фазы:** `Registration` → `Voting` → `Finalized`. Переключение автоматическое при наступлении дедлайна (`_autoAdvancePhase`).

**Функции:**

| Функция | Действие |
|---------|----------|
| `createProposal()` | Создаёт голосование, устанавливает депозит и дедлайны |
| `registerVoter()` / `registerVoters()` | Регистрирует избирателей (только админ, фаза Registration) |
| `revokeVoter()` | Отзывает регистрацию |
| `addCandidate()` | Добавляет кандидата (фазы Registration/Voting) |
| `commit()` | Принимает `keccak256(candidateId, salt)` + ETH-депозит |
| `reveal()` | Проверяет хеш, засчитывает голос, возвращает депозит |
| `finalizeProposal()` | Подсчёт голосов, определение победителя |
| `slashNoReveal()` | Сжигает депозит нераскрывшего голоса (кем угодно после финализации) |

**Commit-Reveal:**
```
commit(hash, deposit) → сохранение хеша + депозита
reveal(candidateId, salt) → проверка keccak256, возврат депозита
slashNoReveal() → депозит сжигается
```

**События:** `ProposalCreated`, `CommitMade`, `VoteRevealed`, `VoterSlashed`, `ProposalFinalized` и др.

## Структура проекта

```
packages/
├── hardhat/
│   ├── contracts/
│   │   └── Voting.sol                  # Контракт: голосование, регистрация, commit/reveal
│   ├── deploy/
│   │   └── 00_deploy_voting.ts         # Скрипт деплоя (rocketh)
│   └── test/
│       └── VotingTest.ts               # Тесты
└── nextjs/
    ├── app/
    │   ├── page.tsx                     # Главная страница
    │   └── voting/
    │       ├── page.tsx                 # Страница голосований (2 таба)
    │       └── _components/
    │           ├── CreateProposalForm   # Форма создания голосования
    │           ├── ProposalCard         # Карточка предложения
    │           └── AdminPanel           # Панель администратора
    └── components/
        ├── Header.tsx                   # Навигация
        └── ScaffoldEthAppWithProviders  # Провайдеры (RainbowKit, Wagmi)
```

## Тесты

```bash
cd packages/hardhat
yarn test
```

Файл `VotingTest.ts` содержит полный набор unit-тестов контракта `Voting.sol`. Тесты используют `loadFixture` для изоляции каждого сценария и `networkHelpers.time.increase` для перемещения времени между фазами.

**Сценарии:**

| Группа | Тест | Что проверяется |
|--------|------|-----------------|
| **Deployment** | nextProposalId == 1 | Корректная инициализация счётчика |
| **Registration** | Регистрация избирателя | `isVoter` устанавливается в true |
| | Отказ не-админу | `"Not admin"` при вызове от чужого адреса |
| | Отказ незарегистрированному | `"Not registered voter"` при commit без регистрации |
| **Commit** | Валидный commit | Принимает хеш + депозит, эмитит `CommitMade` |
| | Двойной commit | `"Already committed"` при повторном вызове |
| | Недостаточный депозит | `"Insufficient deposit"` при сумме ниже `depositRequired` |
| **Reveal** | Валидный reveal | Проверяет хеш, засчитывает голос, эмитит `VoteRevealed` |
| | Неверный salt | `"Invalid reveal"` при несовпадении хеша |
| **Admin** | Смена админа | `proposal.admin` обновляется |
| | Отказ не-админу | `"Not admin"` при попытке смены |
| **Finalization** | Подсчёт голосов | `voteCount` кандидатов корректен после reveal |

## License

MIT
