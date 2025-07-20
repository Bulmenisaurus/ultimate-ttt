import { coordinatesEqual, Game, Move } from './tictactoe';

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
    if ((window as any)._debug) debugger;
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
            const tile = game.currentState.grid[x][y];
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

const main = () => {
    const container = document.getElementById('container')!;
    const game = new Game();

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

    game.onMove = (move) => {
        if (game.currentState.playerToMove === 'O') {
            // get all legal moves and pick one at random
            const legalMoves = game.legalMoves();
            if (legalMoves.length > 0) {
                const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                game.doMove(randomMove);
                updateBoard(container, game);
            }
        }
    };
    updateBoard(container, game);
};

main();
