// https://medium.com/@quasimik/implementing-monte-carlo-tree-search-in-node-js-5f07595104df

import { Game, GameOutcome, GameState, Move, otherPlayer } from './tictactoe';

const moveHash = (move: Move): string => {
    return `${move.coordinate.join(move.player)}`;
};

/** Class representing a node in the search tree. */
class MonteCarloNode {
    play: Move | null;
    state: Game;
    n_plays: number;
    n_wins: number;
    parent: MonteCarloNode | null;
    children: Map<string, { play: Move; node: MonteCarloNode | null }>;
    constructor(
        parent: MonteCarloNode | null,
        play: Move | null,
        state: Game,
        unexpandedPlays: Move[]
    ) {
        this.play = play;
        this.state = state; // Monte Carlo stuff
        this.n_plays = 0;
        this.n_wins = 0; // Tree stuff
        this.parent = parent;
        this.children = new Map();
        for (let play of unexpandedPlays) {
            this.children.set(moveHash(play), { play: play, node: null });
        }
    }

    /** Get the MonteCarloNode corresponding to the given play. */
    childNode(play: Move): MonteCarloNode {
        let child = this.children.get(moveHash(play));
        if (child === undefined) {
            throw new Error('Child not found');
        }
        if (child.node === null) {
            throw new Error('Child not expanded');
        }
        return child.node;
    }

    /** Expand the specified child play and return the new child node. */
    expand(play: Move, childState: Game, unexpandedPlays: Move[]): MonteCarloNode {
        if (!this.children.has(moveHash(play))) {
            throw new Error('Child not found');
        }
        let childNode = new MonteCarloNode(this, play, childState, unexpandedPlays);
        this.children.set(moveHash(play), { play: play, node: childNode });
        return childNode;
    }

    /** Get all legal plays from this node. */
    allPlays(): Move[] {
        return Array.from(this.children.values()).map((child) => child.play);
    }

    /** Get all unexpanded legal plays from this node. */
    unexpandedPlays(): Move[] {
        return Array.from(this.children.values())
            .filter((child) => child.node === null)
            .map((child) => child.play);
    }

    /** Whether this node is fully expanded. */
    isFullyExpanded(): boolean {
        return Array.from(this.children.values()).every((child) => child.node !== null);
    }

    /** Whether this node is terminal in the game tree, 
      NOT INCLUSIVE of termination due to winning. */
    isLeaf(): boolean {
        return this.children.size === 0;
    }

    /** Get the UCB1 value for this node.
     * Not defined for the root node.
     */
    getUCB1(biasParam: number): number {
        if (this.parent === null) {
            throw new Error('UCB1 not defined for root node');
        }
        return (
            this.n_wins / this.n_plays +
            Math.sqrt((biasParam * Math.log(this.parent.n_plays)) / this.n_plays)
        );
    }
}

/** Class representing the Monte Carlo search tree. */
export class MonteCarlo {
    game: Game;
    UCB1ExploreParam: number;
    nodes: Map<string, MonteCarloNode>;
    constructor(game: Game, UCB1ExploreParam = 2) {
        this.game = game;
        this.UCB1ExploreParam = UCB1ExploreParam;
        this.nodes = new Map(); // map: State.hash() => MonteCarloNode
    }
    /** From given state, repeatedly run MCTS to build statistics. */
    runSearch(state: Game, timeout = 3) {
        this.makeNode(state);
        let i = 0;
        let end = Date.now() + timeout * 1000;

        while (Date.now() < end) {
            let node = this.select(state);
            let winner = node.state.checkWinWholeBoard();
            if (node.isLeaf() === false && winner === 'none') {
                node = this.expand(node);
                winner = this.simulate(node);
            }
            this.backpropagate(node, winner);
            i++;
        }
        console.log('runSearch', i);
    }

    /** If given state does not exist, create dangling node. */
    makeNode(state: Game) {
        if (!this.nodes.has(state.hash())) {
            let unexpandedPlays = state.legalMoves().slice();
            let node = new MonteCarloNode(null, null, state, unexpandedPlays);
            this.nodes.set(state.hash(), node);
        }
    }

    /** Get the best move from available statistics. */
    bestPlay(state: Game) {
        this.makeNode(state);
        // If not all children are expanded, not enough information
        // if (!this.nodes.get(state.hash())!.isFullyExpanded()) {
        //     throw new Error('Not enough information!');
        // }
        let node = this.nodes.get(state.hash())!;
        let allPlays = node.allPlays();
        let bestPlay;
        let max = -Infinity;
        for (let play of allPlays) {
            let childNode = node.childNode(play);
            // skip unexpanded nodes (probably would've been caught by the condition above)
            if (childNode.n_plays === 0) {
                continue;
            }
            if (childNode.n_plays > max) {
                bestPlay = play;
                max = childNode.n_plays;
            }
        }
        if (bestPlay === undefined) {
            throw new Error('No best play found. Was bestPlay called on a leaf node?');
        }
        return bestPlay;
    }
    /** Phase 1, Selection: Select until not fully expanded OR leaf */
    select(state: Game): MonteCarloNode {
        let node = this.nodes.get(state.hash())!;
        while (node.isFullyExpanded() && !node.isLeaf()) {
            let plays = node.allPlays();
            let bestPlay;
            let bestUCB1 = -Infinity;
            for (let play of plays) {
                let childUCB1 = node.childNode(play).getUCB1(this.UCB1ExploreParam);
                if (childUCB1 > bestUCB1) {
                    bestPlay = play;
                    bestUCB1 = childUCB1;
                }
            }
            if (bestPlay === undefined) {
                throw new Error('No best play found. Was select called on a leaf node?');
            }
            node = node.childNode(bestPlay);
        }
        return node;
    }

    /** Phase 2, Expansion: Expand a random unexpanded child node */
    expand(node: MonteCarloNode) {
        let plays = node.unexpandedPlays();
        let randomMove = plays[Math.floor(Math.random() * plays.length)];

        const childState = node.state.copy();
        childState.doMove(randomMove);
        let childUnexpandedPlays = childState.legalMoves();
        let childNode = node.expand(randomMove, childState, childUnexpandedPlays);
        this.nodes.set(childState.hash(), childNode);
        return childNode;
    }

    /** Phase 3, Simulation: Play game to terminal state, return winner */
    simulate(node: MonteCarloNode): GameOutcome {
        let state = node.state.copy();
        let winner = state.checkWinWholeBoard();
        while (winner === 'none') {
            let plays = state.legalMoves();
            let play = plays[Math.floor(Math.random() * plays.length)];
            state.doMove(play);
            winner = state.checkWinWholeBoard();
        }
        return winner;
    }
    /** Phase 4, Backpropagation: Update ancestor statistics */
    backpropagate(node: MonteCarloNode, winner: GameOutcome) {
        let currentNode: MonteCarloNode | null = node;
        while (currentNode !== null) {
            //TODO: do i have to increment n_wins on draw?
            currentNode.n_plays += 1;
            // Parent's choice
            if (otherPlayer(currentNode.state.currentState.playerToMove) === winner) {
                currentNode.n_wins += 1;
            }
            currentNode = currentNode!.parent;
        }
    }

    getStats(state: Game) {
        let node = this.nodes.get(state.hash())!;
        let stats: any = { n_plays: node.n_plays, n_wins: node.n_wins, children: [] };

        for (let child of node.children.values()) {
            if (child.node === null) {
                stats.children.push({ play: child.play, n_plays: null, n_wins: null });
            } else {
                stats.children.push({
                    play: child.play,
                    n_plays: child.node.n_plays,
                    n_wins: child.node.n_wins,
                });
            }
        }
        return stats;
    }
}
