import { range } from './util';

export type Player = 'X' | 'O';
export type Tile = Player | null;
export type GameOutcome = Player | 'none' | 'draw';
export type Coordinate = [number, number];

const otherPlayer = (player: Player): Player => (player === 'X' ? 'O' : 'X');

export const coordinatesEqual = (a: Coordinate, b: Coordinate): boolean =>
    a[0] === b[0] && a[1] === b[1];

const ticTacToeWin = (grid: Tile[][]): GameOutcome => {
    // Check rows
    for (let i = 0; i < 3; i++) {
        if (grid[i][0] && grid[i][0] === grid[i][1] && grid[i][1] === grid[i][2]) {
            return grid[i][0]!;
        }
    }

    // Check columns
    for (let j = 0; j < 3; j++) {
        if (grid[0][j] && grid[0][j] === grid[1][j] && grid[1][j] === grid[2][j]) {
            return grid[0][j]!;
        }
    }

    // Check diagonals
    if (grid[0][0] && grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) {
        return grid[0][0];
    }
    if (grid[0][2] && grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) {
        return grid[0][2];
    }

    // Check for draw (all cells filled)
    const isDraw = grid.every((row) => row.every((cell) => cell !== null));
    if (isDraw) {
        return 'draw';
    }

    return 'none';
};

export interface GameState {
    grid: Tile[][];
    // Subgrid to place in, can be any after filled it
    activeSubgrid: Coordinate | 'any';
    playerToMove: Player;
    complete: boolean;
}

export interface Move {
    coordinate: Coordinate;
    player: Player;

    // For easier undo
    currentSubgrid: Coordinate;
}

export class Game {
    currentState: GameState;

    constructor() {
        this.currentState = {
            grid: range(0, 9).map(() => Array(9).fill(null)),
            activeSubgrid: 'any',
            playerToMove: 'X',
            complete: false,
        };
    }

    checkWinSubgrid(subgrid: Coordinate): Player | 'none' | 'draw' {
        const subgridTiles = range(subgrid[0] * 3, subgrid[0] * 3 + 3).map((x) =>
            range(subgrid[1] * 3, subgrid[1] * 3 + 3).map((y) => this.currentState.grid[x][y])
        );

        return ticTacToeWin(subgridTiles);
    }

    checkWinWholeBoard(): Player | 'none' | 'draw' {
        const gridTiles = range(0, 3).map((x) =>
            range(0, 3).map((y) => {
                const subgridOutcome = this.checkWinSubgrid([x, y]);
                // convert the game outcome to a tile
                if (subgridOutcome === 'none' || subgridOutcome === 'draw') {
                    return null;
                }
                return subgridOutcome;
            })
        );
        return ticTacToeWin(gridTiles);
    }

    /**
     * Does a move, updating the game state
     * Checks if the tile is already occuied or if the move is in the wrong subgrid
     */
    doMove(move: Move) {
        const { coordinate, player } = move;
        const { grid, activeSubgrid, playerToMove } = this.currentState;

        if (grid[coordinate[0]][coordinate[1]] !== null) {
            throw new Error('Tile already taken');
        }

        // check if the move is in the active subgrid
        const subgridX = Math.floor(coordinate[0] / 3);
        const subgridY = Math.floor(coordinate[1] / 3);
        if (
            activeSubgrid !== 'any' &&
            (activeSubgrid[0] !== subgridX || activeSubgrid[1] !== subgridY)
        ) {
            throw new Error('Move is not in the active subgrid');
        }

        // update the game state
        grid[coordinate[0]][coordinate[1]] = player;

        // update the active subgrid to match the coordinate of the move
        // calculate the coordinates within the subgrid
        const offsetX = move.coordinate[0] % 3;
        const offsetY = move.coordinate[1] % 3;

        this.currentState.activeSubgrid = [offsetX, offsetY];

        // however, check if the subgrid is already in a terminal state, then the next player can go wherever
        // check if the subgrid is a win
        const subgridOutcome = this.checkWinSubgrid([offsetX, offsetY]);
        if (subgridOutcome !== 'none') {
            this.currentState.activeSubgrid = 'any';
        }

        // update the player to move
        this.currentState.playerToMove = otherPlayer(player);

        // check if the game is complete
        this.currentState.complete = this.checkWinWholeBoard() !== 'none';

        this.onMove(move);
    }

    undoMove(move: Move) {
        const { coordinate, player } = move;
        // remove the placed tile
        this.currentState.grid[coordinate[0]][coordinate[1]] = null;

        // set the current active subgrid to the previous one
        this.currentState.activeSubgrid = move.currentSubgrid;

        // set the player to the one making the move, since it is their turn again
        this.currentState.playerToMove = player;

        // undoing a move necessarily means the game is not complete
        this.currentState.complete = false;
    }

    legalMoves(): Move[] {
        if (this.currentState.complete) {
            return [];
        }

        const { grid, activeSubgrid, playerToMove } = this.currentState;

        const legalMoves: Move[] = [];
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                // can only place in an incomplete subgrid
                if (this.checkWinSubgrid([x, y]) !== 'none') {
                    continue;
                }
                if (activeSubgrid === 'any' || coordinatesEqual(activeSubgrid, [x, y])) {
                    legalMoves.push(...this.legalMovesSubgrid([x, y]));
                }
            }
        }

        return legalMoves;
    }

    legalMovesSubgrid(subgrid: Coordinate): Move[] {
        const { grid, activeSubgrid, playerToMove } = this.currentState;

        const legalMoves: Move[] = [];
        for (let offsetX = 0; offsetX < 3; offsetX++) {
            for (let offsetY = 0; offsetY < 3; offsetY++) {
                const x = subgrid[0] * 3 + offsetX;
                const y = subgrid[1] * 3 + offsetY;

                if (grid[x][y] !== null) {
                    continue;
                }
                legalMoves.push({
                    coordinate: [x, y],
                    player: playerToMove,
                    currentSubgrid: subgrid,
                });
            }
        }

        return legalMoves;
    }

    onMove(move: Move) {
        // to be overriden
    }
}
