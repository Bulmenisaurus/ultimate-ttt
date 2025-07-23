import { MonteCarlo } from './mcts';
import { coordinatesEqual, Game, GameOutcome, Move } from './tictactoe';

const createSubgrid = (container: HTMLElement, subgridX: number, subgridY: number): HTMLElement => {
    const subgrid = document.createElement('div');
    subgrid.classList.add('subgrid');
    container.appendChild(subgrid);
    subgrid.dataset.status = 'none';
    subgrid.dataset.x = `${subgridX}`;
    subgrid.dataset.y = `${subgridY}`;
    // add the 3x3 grid of smaller containers
    // make sure to generate by rows
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const smallerContainer = document.createElement('div');
            smallerContainer.classList.add('tile');
            subgrid.appendChild(smallerContainer);
            smallerContainer.dataset.x = `${subgridX * 3 + x}`;
            smallerContainer.dataset.y = `${subgridY * 3 + y}`;
            smallerContainer.dataset.status = 'empty';
        }
    }
    return subgrid;
};

const updateBoard = (container: HTMLElement, game: Game) => {
    // update subgrid status
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            const subgrid = container.querySelector(
                `.subgrid[data-x="${x}"][data-y="${y}"]`
            ) as HTMLElement;

            const subgridStatus = game.checkWinSubgrid([x, y]);
            subgrid.dataset.status = subgridStatus;

            const active = game.currentState.activeSubgrid;
            const isCurrentCoordinate = active !== 'any' && coordinatesEqual(active, [x, y]);
            const isUnfinished = subgridStatus === 'none';

            // can only play in the current subgrid or in any unfinished grid when active is any
            const isActive = isCurrentCoordinate || (isUnfinished && active === 'any');
            subgrid.classList.toggle('active', isActive);
        }
    }
    for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
            const tile = game.getTile([x, y]);
            const smallerContainer = container.querySelector(
                `.tile[data-x="${x}"][data-y="${y}"]`
            ) as HTMLElement;
            if (tile === null) {
                smallerContainer.dataset.status = 'empty';
            } else {
                smallerContainer.dataset.status = tile;
            }
        }
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
    const container = document.getElementById('container')!;
    const game = new Game();

    const mctsWorker = new Worker('dist/mcts.worker.js');
    // first, create a 3x3 grid of bigger containers
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const subgrid = createSubgrid(container, x, y);
            container.appendChild(subgrid);
        }
    }

    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // didn't click on a valid square
        if (!target.classList.contains('tile')) {
            return;
        }
        const x = parseInt(target.dataset.x!);
        const y = parseInt(target.dataset.y!);
        const move = game
            .legalMoves()
            .find((move) => move.coordinate[0] === x && move.coordinate[1] === y);
        if (move) {
            game.doMove(move);
        } else {
            console.log('Invalid move');
        }
        updateBoard(container, game);
    });

    // for random play
    // game.onMove = (move: Move) => {
    //     if (game.currentState.complete) {
    //         const result = game.checkWinWholeBoard();
    //         alert(`Game over. ${result} won.`);
    //         return;
    //     }

    //     if (game.currentState.playerToMove === 'O') {
    //         // update player move
    //         updateBoard(container, game);

    //         const allMoves = game.legalMoves();
    //         if (allMoves.length === 0) {
    //             debugger;
    //         }
    //         console.log(allMoves);
    //         const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    //         game.doMove(randomMove);
    //         updateBoard(container, game);
    //     }
    // };

    mctsWorker.onmessage = (event) => {
        const { bestMove, stats } = event.data;
        const winningChances = 1 - stats.n_wins / stats.n_plays;
        console.log('Current states: winning chances at', winningChances.toFixed(2));
        game.doMove(bestMove);
        updateBoard(container, game);
    };

    game.onMove = (move: Move) => {
        if (game.currentState.complete) {
            const result = game.checkWinWholeBoard();
            alert(`Game over. ${result} won.`);
            return;
        }

        if (game.currentState.playerToMove === 'O') {
            // Send the move to the worker
            mctsWorker.postMessage({ type: 'playerMove', payload: { move } });
            // Ask the worker for the AI move
            mctsWorker.postMessage({ type: 'getAIMove' });
        }
    };

    // BENCHMARKING;
    // const startTime = Date.now();
    // const statistics: Record<GameOutcome, number> = {
    //     X: 0,
    //     O: 0,
    //     none: 0,
    //     draw: 0,
    // };
    // for (let i = 0; i < 100000; i++) {
    //     // simulate a full game
    //     while (!game.currentState.complete) {
    //         const moves = game.legalMoves();
    //         if (moves.length === 0) {
    //             break;
    //         }
    //         const move = moves[Math.floor(Math.random() * moves.length)];
    //         game.doMove(move);
    //     }
    //     const outcome = game.checkWinWholeBoard();

    //     statistics[outcome]++;

    //     game.reset();
    // }
    // const endTime = Date.now();
    // console.log(`Time taken: ${endTime - startTime}ms`);
    // console.log(statistics);
};

main();
