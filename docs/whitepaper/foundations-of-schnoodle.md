---
description: The Cornerstones and Four Pillars of Schnoodle
cover: ../.gitbook/assets/brand-background.jpg
coverY: 0
---

# 🏗 Foundations of Schnoodle

## 🗿 Cornerstones of Schnoodle (CoS)

Most DAOs use a governance voting system such as Snapshot for the community to vote for changes. Often, these are off-chain changes, but they can also be on-chain, namely smart contract interaction. All changes must be executed on-chain by the centralised trusted group which is usually multisig controlled. What if enough of the multisig owners disagree with the change to prevent the change happening? What if the multisig owners decide to make a change that the community voted against?

### 🔏 Trustless Autonomous Governance (TAG)

The first Cornerstone of Schnoodle is its Trustless Autonomous Governance (TAG) system which is a smart contract ecosystem that consists of a complex array of decentralised services, smart contracts, and an oracle for fully trustless and autonomous interaction with and upgradeability of the SNOOD ERC-777 token contract.

<details>

<summary>Overview</summary>

Schnoodle removes the need for manual multisig execution by fully automating the on-chain execution of off-chain votes via an oracle that uses simple economic game theory.

After the off-chain (gasless) voting takes place (using [Snapshot](https://snapshot.org/#/schnoodle.eth)), an escalation game-based oracle ([Reality.eth](https://realit.io)) then accepts a bond from a member of the community to confirm the outcome of the vote. If their interpretation of the vote aligns with the actual vote, then after 24 hours, the vote will be finalised. If it does not, then someone else can double the bond and state a different interpretation of the vote. And so on and so forth.

The bond is returned to those who stated the outcome of the vote correctly. In practice, if the off-chain vote is 'Yes', for example, the first person to set the bond will generally also interpret it as 'Yes' and the vote will be finalised on that basis. It's unusual for this not to happen for standard changes that the majority of people vote for, but this is a safeguard to ensure the integrity of the off-chain voting system when executing it automatically on-chain.

Finally, after a 24-hour cool-off period, the change may be executed by anyone.

The [Zodiac](https://gnosis.github.io/zodiac/) Reality Module by [Gnosis Guild](https://www.gnosisguild.org/) integrates Snapshot and Reality.eth. This decentralised process epitomises the Holy Grail of blockchain, something no blockchain project has ever truly achieved.

</details>

Learn more about the architecture of TAG [here](architecture.md#trustless-autonomous-governance).

### 🐕‍🦺 Blockchain Automated Reward Kickbacks (BARK)

The second Cornerstone of Schnoodle is its sophisticated automated wealth distribution system (inspired by [RFI](https://reflect.finance/)) known as Blockchain Automated Reward Kickbacks (BARK). Holders receive rewards constantly (without even farming) whenever there's a sell swap. This has been a tremendous success and garnered exceedingly bullish sentiment from the community that Schnoodle is unlike any other rewards-based coin.

Learn more about BARK [here](architecture.md#bark-algorithm).

## 🏦 Four Pillars of Schnoodle (4PoS)

### 💰 Price Support Mechanism (PSM)

The Price Support Mechanism (PSM) feature was introduced in SchnoodleV6 as a solution to one of the most notable facets of cryptocurrency: volatility. Especially during major market events such as a Bitcoin price correction, or other huge sell-off event. PSM aims to dampen this effect using a simple set of techniques without getting in the way of an open market.

Learn more about it here:

{% content-ref url="../features/psm.md" %}
[psm.md](../features/psm.md)
{% endcontent-ref %}

### 🌔 Moon Farming Platform (MFP)

Our sophisticated and neoteric Moon Farming Platform (MFP) is like yield farming, but far more advanced and fully decentralised. It is the first of its kind with automated regulation of rewards, a gamified yield system, flexible options, and unlimited strategies. It completely breaks the mould of traditional yield farming.

Learn more about it here:

{% content-ref url="../features/mfp.md" %}
[mfp.md](../features/mfp.md)
{% endcontent-ref %}

### 🌉 Fully Autonomous Bridge (FAB)

Schnoodle's goal was always to be EVM-compatible chain agnostic. We have developed a system that allows it to be deployed by anyone on any EVM-compatible chain, and value will automatically be transferable between any two chains. This Fully Autonomous Bridge (FAB) is driven by the Polybridge Infinichain Meshnet Protocol (PIMP), with allows unlimited multichain interoperability.

Learn more about it here:

{% embed url="https://schnoodledao.medium.com/building-a-sustainable-token-bridge-40adc33fd9c7" %}

### 👾 3D NFT Platform (Moontron)

Still in active development, with our game art partner [Kevuru Games](https://kevurugames.com/) developing the 3D artwork, Schnoodle's 3D NFT platform (codename 'Moontron') will literally be a sight to behold. It uses a unique concept of backend rendering and dynamic IPFS persistence to allow dynamic minting of fully-customisable 3D NFTs including algorithmic rarity traits.

<details>

<summary>Overview</summary>

All existing NFT platforms typically require a centralised group of people to mint NFTs. This means there will always be a limited number of them. Rarity traits will be implied during the minting of these NFTs as they will be apportioned manually at that time. However, this also means the NFTs are not scalable. For example, an NFT with 10,000 minted tokens doesn't scale well to a million people. Sure, the tokens themselves are rare, and the tokens' value will change depending on demand. But why not allow more to be minted while maintaining the distribution of rarity traits, and allow the value to depend on those rarity traits rather than a hard limit on the number of tokens? Of course, the NFT smart contract could allow the centralised group to mint more, but that then creates a dangerous precedent whereby tokens could be minted with the rarest traits, and then they profit from them.

Schnoodle's unique system allows tokens to be minted directly to a user's account at the time they pay for it. Moreover, they may customise it how they wish within the boundaries of the rarity traits. For example, they may choose to favour one rarity trait more than another, then the algorithm will favour that trait when randomly configuring the traits. The algorithm will also ensure the distribution of rarity traits stays within defined boundaries.

</details>
