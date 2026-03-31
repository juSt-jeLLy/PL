# mergeX Integrations

This document explains how mergeX uses World Chain, World ID, Filecoin, and the AI layer in the current implementation.

## World Chain

mergeX uses a `MergeXBounty` smart contract deployed on **World Chain Sepolia**.

The contract is responsible for:

- registering repositories on-chain
- holding repository bounty pools
- creating single or batch bounties from GitHub issues
- letting contributors take bounties by staking collateral
- recording PR submission links on-chain
- approving merges, rejecting PRs, and settling rewards
- handling expiry and slashing logic when work is abandoned or not reviewed in time

Current deployed address:

- [`0x4709817e9BBEFB887c7DDd443d39A3BaAA433348`](https://sepolia.worldscan.org/address/0x4709817e9BBEFB887c7DDd443d39A3BaAA433348)

## World ID

mergeX uses World ID as the human-verification layer for contributors.

Why it matters:

- reduces bot participation
- reduces duplicate identity farming
- helps prevent simple Sybil-style abuse in issue claiming
- makes bounty assignment more human-centric instead of purely wallet-centric

In product terms, this gives the platform a stronger answer to "who is actually doing the work?"

## Filecoin

mergeX uses Filecoin-backed storage for audit logs and audit report artifacts.

In the current flow:

- the app emits minimal audit events for important actions
- audit reports and event snapshots are stored through the Filecoin flow used in the backend
- those stored records can be queried again in the audit page
- logs are associated with a repository, which makes later review easier

This gives mergeX a tamper-evident history of important activity rather than relying only on an internal centralized database.

## AI Layer

mergeX uses internal AI-assisted workflows in two places:

- **Codebase analysis for organizations**
  the app analyzes repository code and helps surface security findings, improvement opportunities, severity hints, and suggested bounty values.
- **PR analysis for review**
  the backend reviews submitted pull requests against the linked issue and returns an approval-style recommendation, concerns, and a summary for the organization.

The goal is not to replace maintainers with AI. The goal is to reduce review overhead and make issue creation and PR analysis faster and more structured.

## Why These Pieces Fit Together

Each layer handles a different trust problem:

- **World Chain** makes bounty funding and payout logic more trustless.
- **World ID** makes the contributor side more resistant to botting and Sybil abuse.
- **Filecoin** makes actions and audit artifacts inspectable later.
- **AI assistance** makes issue creation and PR review faster without hiding the workflow entirely off-platform.

Together, they make mergeX a more transparent and accountable open-source bounty system.
