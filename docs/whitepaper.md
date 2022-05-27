---
description: Accessible to all, without the compromise
coverY: 0
---

# 📝 Whitepaper

## Schnoodle Backstory

Schnoodle was incepted by our founder and CTO, Jason Payne, who decided to build Schnoodle because he was disillusioned with cryptocurrencies being released one after the other that had no real innovation, and were mostly copypasta smart contract clones of other tokens with a few tweaks. And those tweaks were typically convoluted layers of abstraction that usually benefited the dev team rather than the community.

_**And who's your development team?**_

While we have a small team of frontend and backend developers working on Schnoodle, Jason is the lead developer on the full stack, but the only one who works on the blockchain code - this is for security and quality reasons. He has an extensive track record working for many years in the investment banking industry as a senior software developer (see his [LinkedIn profile](https://www.linkedin.com/in/techjp/)), and currently leads two IT divisions for the largest educational publisher in the Netherlands.

Jason's online name is [Neo](https://twitter.com/Neo42), and this is where it gets interesting...

_**Tell me more...**_

In 2020, a DeFi project known as RFI was incepted by [Reflect Foundation](https://reflect.finance/) for which the contract code was developed by the notorious developer known as Morpheus. Do you see where we're going with this? 😉 The project became controversial as the code was copyrighted, but he eventually [open-sourced](https://github.com/reflectfinance/reflect-contracts/blob/main/contracts/REFLECT.sol) it. The contract can be found [here](https://etherscan.io/address/0xa1afffe3f4d611d252010e3eaf6f4d77088b0cd7#code).

The key idea behind this code is that it contains a complex algorithm using lots of complex states to "reflect" a different balance to holders that includes a distribution of fees from other transfers. In other words, whenever the token is sold, a fee is charged and distributed algorithmically to all other holders.

Copies of this code were then used as the basis of [SAFEMOON](https://www.bscscan.com/address/0x8076c74c5e3f5852037f31ff0093eeb8c8add8d3#code), and the dog meme coin [HOKK](https://etherscan.io/address/0xc40af1e4fecfa05ce6bab79dcd8b373d2e436c4e#code).

_**So, lemme guess. Neo wanted to kick Morpheus' ass?**_

![Neo dawg vs Morpheus dawg](.gitbook/assets/neo-vs-morpheus.png)

In analysing this code, Neo noticed that there were numerous inexcusable flaws that simply indicated laziness and haste on the part of the devs. Absolutely no care had been taken to ensure holders were given the best deal in terms of gas fees and potential ruggability. There are functions that allow the contract owner to include and exclude addresses from the fee process at will. How is this fair to other holders? And the code for SAFEMOON was compiled with Solidity 0.6.12 which was already over 7 months old at the time of launch when Solidity was _already_ at version 0.8.1. This may not sound hugely important, but it takes very little effort to use a more recent version, and this would have afforded some code tweaks that would result in less gas fees for holders.

Not only that, but the devs didn't even enable optimisation on deployment (as can be seen at the top of the contract page). Again, highly lazy, or just plain incompetence, and it's the holders who suffer.

HOKK was released more than a month later and made no such improvements. Just a straight copy of the RFI code, and another marketing campaign to get another batch of unsuspecting dog meme coin hunters aping into their dog poo coin.

_**OK, sounds like a gravy chain, but dogs love gravy on their food, right?**_

Perhaps, but Crufts dogs like gourmet. So, Neo got to work and set out to revise Morpheus' reflective algorithm stripping out any superfluous code, and ensuring that he would use the best techniques, practices and leading-edge technologies the blockchain space has to offer. And so, Schnoodle was born, like a cute little puppy ready to take on the world.

_**Well, the world's a big place filled with many dogs. What makes Schnoodle so different?**_

### Eleemosynary Fund

Not a word you hear every day. But as part of Schnoodle's benevolent approach to crypto, we don't want to jump on the dog charity bandwagon, or indeed any other arbitrary charity as some sort of thinly-veiled guise to appear magnanimous.

So, Schnoodle includes an eleemosynary fund as part of its encoding. This can be a charity, but also any worthy cause that the community feels passionate towards. Perhaps carbon offsetting to advocate clean energy usage in blockchain, especially proof-of-work (PoW) blockchains such as Ethereum. Or, humanitarian causes such as the unbanked of the world due to corrupt governments or poor economies.

_**What if I don't feel charitable, or don't agree with the beneficiary?**_

Well, charity is certainly a deep topic awash with philosophical and political nuances, and not everyone wants to give up a small part of their wealth for benevolent causes; and some may even wish to choose who they donate to.

Part of the ideology behind contributing to a benevolent cause is that people will like it. This will in principle have the effect of promulgating the benefactor (in this case, Schnoodle) further, thereby attracting more holders and driving the price up further. This benefits both the eleemosynary fund and holders alike which is of course a win-win situation for everybody! In fact, our marketing campaigns will be largely based around this, and will include promoters that are motivated by such altruistic innovations.

And the beneficiary of the eleemosynary fund is by no means static. This is determined by the community as part of Schnoodle's [timelocked governance](whitepaper.md#timelocked-governance) feature.

_**Philanthropy and becoming rich at the same time. Awesome. Now show me the contract!**_

## Smart Contracts

As already mentioned, existing RFI-based tokens and dog meme coins use archaic technologies and lazy or bad practices. And by 'archaic', that's unnecessarily using technology that's been superseded more than 6 months prior, and in blockchain, 6 months is of course a very long time.

### ERC-777 Standard

This is why Schnoodle uses the latest [OpenZeppelin Contracts](https://openzeppelin.com/contracts/) library which is a respected and established base on which any Ethereum smart contract worth its salt is based upon. Schnoodle goes a step further and leverages the preset contract `ERC777PresetFixedSupplyUpgradeable` which provides OOTB standard [ERC-777](https://eips.ethereum.org/EIPS/eip-777) functionality, namely _operators_ to send tokens on behalf of another address—contract or regular account—and send/receive _hooks_ to offer holders more control over their tokens.

_**Hold on! Does this make Schnoodle the only ERC-777 dog meme coin in existence?**_

As far as we know, yes. And ERC-777 is fully backward-compatible with the [ERC-20 token standard](https://eips.ethereum.org/EIPS/eip-20), and therefore includes, by way of the OpenZeppelin base contracts, standard ERC-20 functionality such as transfer, approval, balance, total supply, and basic token details functionality, as well as burning and upgradeability of the contract (more on that [later](whitepaper.md#upgradeability)). This means that holders can be sure that the base contracts that Schnoodle subclasses are tried, tested and even audited.

And the way the contracts are deployed is as separate files under the same contract (not flattened), which makes it easier for you (if you want to) to focus on the actual business logic of the Schnoodle smart contract, and not have to worry about the basic standard functionality containing a potential exploit or other hidden "easter egg". What you see is what you get, basically.

_**Great you're using the latest tech. What about the Schnoodle code itself?**_

### Latest Solidity

Indeed. Well, the Schnoodle smart contract is compiled with the latest version of Solidity (0.8.14 at the time of writing the last update) to ensure maximum efficiency in terms of gas fees, and to eliminate any possibility of known bugs in the compiler potentially leaving the contract open to exploit (unlikely, but the safety of holders' funds is Schnoodle's absolute priority, no matter how remote any given risk is). By way of a simple example, take the RFI code that SAFEMOON and HOKK both use:

```
x = x.sub(y)
```

`sub` is a `SafeMath` function to eliminate overflow errors. In the latest versions of Solidity, this gas-intensive operation simply isn't necessary anymore. And it means the temporary assignment in memory of `x` prior to calling `sub` is also not necessary because the subtraction assignment operator can be used which is already optimal without the optimiser running on it further (which, as noted earlier, the RFI-based tokens don't even enable). So, this is what Schnoodle does instead:

```
x -= y
```

Same outcome, way simpler, far less gas. And quite simply, beautiful, lean and clean.

_**That sounds much better for holders. What about the algorithm itself?**_

### BARK Algorithm

The RFI algorithm comprises a lot of complex proprietary code which obfuscates the business logic. The RFI algorithm stores two sets of balances for holders: their true balance (`_tOwned`), and their reflected balance (`_rOwned`). Neo's code strips away this complexity and instead leverages the existing provisions of the OpenZeppelin Contracts, namely the `ERC777Upgradeable` contract, to store all reflected balances.

So, where the original RFI algorithm performed an effective burn on the total reflected supply by doing a subtraction in the code, Neo's code performs a true burn using the OpenZeppelin code directly on the recipient's reflected balance. The BARK algorithm therefore becomes simple but smart, and operates in both the `transfer` and `balanceOf` functions, as thus:

#### `transfer`

This comprises two transfers. One from the sender to the recipient, and one from the sender to the eleemosynary fund.

$$
amount × reflectedTotalSupply ÷ totalSupply
$$

Each of those transfers is followed by a burn on the receiver's reflected balance:

$$
amount × chargeRate × reflectedTotalSupply ÷ totalSupply
$$

#### `balanceOf`

$$
reflectedBalance ÷ reflectedTotalSupply ÷ totalSupply
$$

* `amount` is the amount of tokens being transferred whether the main or eleemosynary amount.
* `reflectedTotalSupply` is exactly that, but is effectively reduced on every transfer due to the burn.
* `totalSupply` remains constant as this represents the total SNOOD supply and is never reduced by the algorithm.
* `chargeRate` represents the fee or donation charged for every transfer.
* `reflectedBalance` is the reflected balance of the address requested, as stored in the OpenZeppelin `_balances` mapping state.

The BARK algorithm basically ensures that transfer fees are dynamically redistributed to holders proportionate to their respective balances relative to the total supply. The algorithm rewards loyalty, so new holders will only benefit from the redistribution of transfer fees _after_ they become a holder.

As the distribution of **rewards** to holders is completely **automated** within the smart contract on the **blockchain**, we call this the BARK algorithm. Blockchain Automated Reward Kickbacks. **Kickbacks** because it's the only word we could think of to make it into a dog-related acronym.

_**Very neat indeed, but does that mean liquidity providers are also subject to the same rules?**_

Yes, spot on. The lack of exclusion functions means that even the LPs and the liquidity tokens themselves are subject to the exact same fees and rewards system.

This effectively results in a completely fair ecosystem where anyone holding SNOOD tokens for as long as Schnoodle remains a going concern continues to be rewarded. And we will cover that in more detail [later](whitepaper.md#schnoodle-dao) as we talk about it becoming a true DAO in its future roadmap to ensure that Schnoodle grows for as long as the community wants it to.

_**So, you launch Schnoodle and add liquidity to Uniswap. How do we know it won't be rugged?**_

### Locked Liquidity

Unlike other dog-themed and RFI-based coins, Schnoodle is intended to be trustless. This means that there is no requirement for you to trust that the team will do what it promises, as we ensure that everything is in the code. This ensures that you have the confidence to use Schnoodle without being concerned about promises not being fulfilled.

This is why we lock the initial liquidity for a minimum of 6 months in our `SchnoodleTimelock` contract which is based on the tried-and-tested OpenZeppelin [`TokenTimelock`](https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#TokenTimelock) contract. We hope by that time, there will be enough LPs to make the pool liquid enough for this to no longer be a concern. But if that's not the case, then we will of course lock our liquidity for another 6 months before the first 6 months lapses. And we will advertise this on all our channels including [Telegram](https://t.me/SchnoodleDeFi).

Locked liquidity for 6 months gives peace of mind for holders, and eliminates ruggability even further.

### Locked Pool Tokens

Schnoodle uses the [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) standard to allow us to deploy as many `SchnoodleTimelock` contracts as required. These are known as minimal proxy contracts, or simply "clones", and are created through our `SchnoodleTimelockFactory` contract. As well as liquidity, we use these clones to lock the community reserves. This is an extremely gas-efficient method to create timelock contracts, which means we can lock tokens from the community pool later for individuals such as influencers who will help promote Schnoodle.

Schnoodle is now truly destined to be man's best friend.

_**I'm sold. But you said something earlier about upgradeability...**_

### Upgradeability

Yes. Well, the idea is that the state of Schnoodle on launch is not the do all and end all. While we have gone to painstaking measures to ensure the initial Schnoodle smart contract has everything it needs to function as a fully tested production-ready coin, we have big plans for Schnoodle because we believe it will change the face of dog-themed tokens into something far greater than others trying to join the gravy train.

We have made it upgradeable.

_**But the blockchain is immutable. Upgrading a smart contract means all holders must undergo a token swap, right?**_

Not quite. Using the OpenZeppelin [`TransparentUpgradeableProxy`](https://docs.openzeppelin.com/contracts/4.x/api/proxy#TransparentUpgradeableProxy) contract, Schnoodle leverages the [EIP-1967 Transparent Proxy](https://eips.ethereum.org/EIPS/eip-1967) pattern whereby a proxy contract is deployed. All interactions with Schnoodle go via this proxy, and if you view the proxy contract on Etherscan, you will notice two additional buttons on the _Contract_ tab: _Read as Proxy_ and _Write as Proxy_. These show the ABI of the underlying implementation contract (`Schnoodle`) to which there is a link on the respective 'proxy' pages.

The beauty of this is that the `Schnoodle` smart contract can be upgraded in the future without changing the contract address because the proxy contract never changes. And due to the immutability of blockchain, the existing state can never be changed. We can only add new state.

And the linchpin to the proxy contract and the implementation contract is a third contract known as the `ProxyAdmin` contract. It is through this contract that all upgrades are conducted.

_**Wow; sounds great. But doesn't that mean you could change Schnoodle into a less desirable dog, such as a Poodle or a yappy Chihuahua?**_

### Timelocked Governance

Well, that's where we've gone the extra mile (we're halfway to the moon right now, to be fair), and implemented governance into Schnoodle in the form of `SchnoodleGoverance` smart contract which implements the ERC-165 standard.

_**Awesome. How TF does that work?**_

This is basically a smart contract that derives from the OpenZeppelin `TimelockController` base contract. During deployment of `SchnoodleGovernance`, ownership of both the `Schnoodle` contract and the aforementioned `ProxyAdmin` contract is transferred to it so that any changes or upgrades to the `Schnoodle` contract are delayed by a minimum time period so that holders can view the change/upgrade on the blockchain before it becomes effective. If holders don't like it or find a problem with it, they can take action straight away, or we can cancel the change/upgrade.

_**I just buy dog tokens, dude; where do I even go to check pending upgrades?**_

Granted, it's not a simple out-of-the-box method, but once you know how, it's pretty easy, and you get to learn a little about browsing the blockchain on Etherscan. Just follow these steps:

1. Go the [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599).
2. Select a recent transaction with method `Exec Transaction` and view its logs. If the logs include an event called `CallScheduled`, then this is a scheduled contract interaction. The next steps outline how to decode this log.
3. You will see in the `target` field an address. This is the contract being interacted with, and will resolve to the `ProxyAdmin` contract for upgrades.
4. For upgrades, you will see in the `data` field three values separated by `000000000000000000000000` (24 zeros), as thus:
   1. The first value is the `upgrade` function being called and will show as `99A88EC4`.
   2. The second value is the address of the `TransparentUpgradeableProxy` contract being upgraded.
   3. The third value is the address of the new implementation contract (e.g., `SchnoodleV2`).

Armed with the above, you can now view any pending upgrade before it is executed and becomes live. Once an upgrade is executed, this will appear as a `CallExecuted` event in the [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599) logs.

_**Cool. But you can still ignore us if we don't agree with an upgrade, right?**_

### Multisig Protection

We would never do that. But as an additional layer of protection, we have added multisig to the process using [Gnosis Safe](https://gnosis-safe.io/). This means that upgrades cannot happen without multiple parties signing the change. Under the covers, `SchnoodleGovernance` is deployed with the proposer and executor of actions on the contract set to our [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599) where multiple signatory wallets are required for signing contract interactions such as upgrades. This protects you the holder against unilateral decisions or, even worse, leaked private keys like [what happened with PAID Network](https://youtu.be/v28yihfpP\_E).

_**This all sounds really complicated. Explain again, like I'm a 2-year-old dog.**_

Right. So, the `Schnoodle` smart contract is deployed to the Ethereum blockchain along with three other contracts:

* `TransparentUpgradeableProxy`: All interaction with Schnoodle is done via this proxy.
* `ProxyAdmin`: Any upgrades can only be done via this contract which is owned by...
* `SchnoodleGovernance`: This executes 'upgrade' calls on _ProxyAdmin_ but only after a minimum time period has elapsed (set in the contract). And this contract can only be interacted with by our Gnosis Safe address.

In the event of an upgrade, the following steps take place:

1. The new `Schnoodle` contract version (say, `SchnoodleV2`) is prepared with the proxy (this means it's not yet active, but _ready_ to activate).
2. Then, the scheduled upgrade is signed off by the multi-signatory wallets at the [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599) and broadcast to the blockchain.
3. After the minimum required timelock has elapsed as per `SchnoodleGovernance`, the upgrade is executed at the [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599), again requiring sign-off by the multi-signatory wallets, and broadcast to the blockchain.
4. Any scheduled or executed upgrades can be seen in the transactions of the [Gnosis Safe address](https://etherscan.io/address/0x81296C370418c4A9534599b5369A0c2913133599). The event log of the `SchnoodleGovernance` contract address is also a way to see these events.

With this comprehensive and highly sophisticated process, it now means we have two solid layers of protection for our holders: upgrade timelock protection and multisig.

![Architecture](.gitbook/assets/architecture.svg)

_**I love it. But I still have a niggle. What if the whole team mutinies or goes rogue?**_

Well, in reality, this would only happen if we were savagely attacked by flesh-eating dog zombies, and we turned into said dog zombies ourselves bent on destroying all humans. But we hear you. Enter, Schnoodle DAO...

### Trustless DAO

Besides BARK, this is one of the key features of Schnoodle that makes it the first true DAO of the blockchain where upgrades are only permitted if the holders vote in favour of them. This is a fully automated process that really puts the 'A' in DAO.

This makes use of an extended feature of Gnosis Safe known as [SafeSnap](https://github.com/gnosis/dao-module) through which any upgrade proposals must be made. This acts as the linchpin between two other platforms known as [Snapshot](https://snapshot.org/#/schnoodle.eth) and [reality.eth](https://realit.io/).

_**Wow! Three more blockchain platforms in the mix. Schnoodle really is the dog's bollocks, right?**_

Right. But they all serve an important purpose. Our [Snapshot space](https://snapshot.org/#/schnoodle.eth) is where any holder over a defined threshold can make a proposal for anything (not just upgrades), and then the proposal can be voted on by holders. This voting mechanism is off-chain thus saving you gas. Voting is free unlike many other quasi-DAO platforms such as Aragon, DAOstack, Colony and Compound.

_**Free as in beer? But doesn't that come at the expense of a measure of decentralization?**_

Right. Which is where reality.eth comes in. This is essentially a very cool escalation-game-based oracle that SafeSnap uses to allow trustless, on-chain execution based on the outcome of the off-chain votes.

The science bit... _**(Huh? I thought we'd passed the science bit!)**_

The Schnoodle Snapshot space is connected to the SafeSnap DAO module instance using the SafeSnap plugin via the Snapshot space settings where the address of the DAO module instance is specified. Access-control logic for the DAO module instance is enabled to execute transactions on our Gnosis Safe account using the [`Transaction Builder`](https://help.gnosis-safe.io/en/articles/4934427-add-a-module) app in Gnosis Safe.

_**Umm, OK. So, can I finally make a proposal?**_ 💍

Yes! Proposals to execute an upgrade (on `ProxyAdmin`), which can be done by anyone including you, can now be made via Snapshot where off-chain votes are gathered. Once voting has closed, a question is placed on reality.eth asking if the proposal passed. This question is posed for 24 hours before the outcome may be finalised. The question may be answered by anyone with the placement of a bond in ETH.

If the vote is in favour and the reality.eth question confirms this, reality.eth can then be triggered (via a button in Snapshot, by anyone) to execute the upgrade via Gnosis Safe (which, as explained earlier, is connected to `ProxyAdmin` via `SchnoodleGovernance` which is the owner of `ProxyAdmin` which can therefore only be interacted with by our Gnosis Safe account).

_**This sounds brilliant! But aren't you worried about holders making a dog's dinner of everything?**_

Well, with great power comes great responsibility. But that power needs to be earned. So, in the beginning, while everything is autonomous, if we could see that something really bad was about to happen (e.g., an upgrade with a serious flaw that no one noticed, or some sort of holder 51% attack), then the multisig owners can step in and intervene during the 24-hour cooldown period and prevent execution of the upgrade. The admins of the Snapshot space may also delete proposals at any time.

Conversely, if we noticed something bad could happen due to a bug or a sour agreement with a community member or partner, for example, the multisig owners can interact with the contract or deploy an emergency upgrade to prevent this and protect the community.

_**Phew! OK, but then it's still not really fully decentralised then, is it?**_

Not fully, but once the team are confident that the holders are responsible, and there are enough of them to prevent malicious attacks, then the team will increase the multisig requirement and invite trusted and impartial community members to be additional multisig owners in Gnosis Safe to act as stewards. And also introduce a community-driven mechanism to change multisig ownership at any time via the DAO process. The team will also remove themselves as individual admins from the Snapshot space, and make the admin into a single multisig community account.

At this point, Schnoodle becomes the world's first truly progressive DeFi DAO, and we really put the 'D' in DAO.

_**Oh, wow. I'm so excited, my tail is wagging like a metronome!**_

For comparison, there are several well-known projects such as Yearn, Sushi, Balancer, Aave, DIA and Synthetix that use Gnosis Safe and Snapshot to gather off-chain votes, with a team "promise" that they will execute proposals voted for.

By using SafeSnap on top of this, Schnoodle becomes completely autonomous once a proposal goes in. This puts Schnoodle technologically way ahead of all the aforementioned projects, not to mention other meme coins. We are the first truly trustless and progressive DeFi DAO on the blockchain! And once multisig ownership becomes completely community-driven, then Schnoodle becomes truly decentralised and autonomous. 🚀

## Feature Roadmap

This whitepaper primarily covers the core fundamentals of Schnoodle including its architecture. Schnoodle has always had an ambitious roadmap and we continue to deliver on this constantly. Since launching Schnoodle, we have already delivered some major features and you can find details on these in this documentation, or use the following links:

{% content-ref url="features/psm.md" %}
[psm.md](features/psm.md)
{% endcontent-ref %}

{% content-ref url="features/mfp.md" %}
[mfp.md](features/mfp.md)
{% endcontent-ref %}

As if that isn't enough, we have many other plans for Schnoodle, and you can find our updated roadmap on our [website](http://schnoodle.finance/). For example, we intend to eventually offer NFT rewards to yield farmers just for farming your SNOOD tokens.
