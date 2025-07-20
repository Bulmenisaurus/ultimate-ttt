// https://medium.com/@quasimik/implementing-monte-carlo-tree-search-in-node-js-5f07595104df

import { GameState } from './tictactoe';

/** Class representing the Monte Carlo search tree. */
export class MonteCarlo {
    /** From given state, repeatedly run MCTS to build statistics. */
    runSearch(state: GameState, timeout: number) {
        // TODO
    } /** Get the best move from available statistics. */
    bestPlay(state: GameState) {
        // TODO
        // return play
    }
}
