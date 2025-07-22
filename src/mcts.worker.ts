import { MonteCarlo } from './mcts';
import { Game } from './tictactoe';

let game: Game = new Game();
let mcts: MonteCarlo = new MonteCarlo(game);

self.onmessage = function (e) {
    const { type, payload } = e.data;
    if (type === 'playerMove') {
        game.doMove(payload.move);
    } else if (type === 'getAIMove') {
        mcts.runSearch(game, 10);
        const bestMove = mcts.bestPlay(game);
        console.log('test');

        const stats = mcts.getStats(game);
        // Apply the AI move to the internal game state
        game.doMove(bestMove);
        self.postMessage({ bestMove, stats });
    }
};
