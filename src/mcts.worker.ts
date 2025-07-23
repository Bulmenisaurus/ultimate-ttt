import { MonteCarlo } from './mcts';
import { Game } from './tictactoe';

let game: Game = new Game();
let mcts: MonteCarlo = new MonteCarlo(game);

const TIME_LIMIT = 3000;

self.onmessage = function (e) {
    const { type, payload } = e.data;
    if (type === 'playerMove') {
        game.doMove(payload.move);
    } else if (type === 'getAIMove') {
        console.log('getAIMove start');
        const startTime = Date.now();
        //TODO: deal with memory issues :(
        mcts.runSearch(game, TIME_LIMIT);
        const bestMove = mcts.bestPlay(game);

        const stats = mcts.getStats(game);
        // Apply the AI move to the internal game state
        game.doMove(bestMove);
        console.log('mcts nodes size', mcts.nodes.size);
        self.postMessage({ bestMove, stats });
        const elapsedTime = Date.now() - startTime;
        console.log('getAIMove end, elapsed time', elapsedTime);

        if (elapsedTime / TIME_LIMIT > 1.5) {
            console.warn('Excessive time taken. Memory/GC issues likely.');
        }

        if (elapsedTime / TIME_LIMIT > 2) {
            console.warn('Double time limit. Clearing nodes.');
            mcts.nodes.clear();
        }
    }
};
