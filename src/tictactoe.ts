import { range } from './util';

export type Player = 'X' | 'O';
export type Tile = Player | null;
export type GameOutcome = Player | 'none' | 'draw';
type ExtendedTile = GameOutcome;
export type Coordinate = [number, number];

export const otherPlayer = (player: Player): Player => (player === 'X' ? 'O' : 'X');

export const coordinatesEqual = (a: Coordinate, b: Coordinate): boolean =>
    a[0] === b[0] && a[1] === b[1];

const isPlayer = (tile: ExtendedTile): tile is Player => tile === 'X' || tile === 'O';

// Checks the win given a 3x3 set of tiles
// Each tile can either belong to one of the players, be empty, or be a draw (!)
// The last case is only used for the larger grid where it is useful to distinguish incomplete and drawn subgrids
const ticTacToeWin = (grid: ExtendedTile[][]): GameOutcome => {
    // Check rows
    for (let i = 0; i < 3; i++) {
        if (isPlayer(grid[i][0]) && grid[i][0] === grid[i][1] && grid[i][1] === grid[i][2]) {
            return grid[i][0]!;
        }
    }

    // Check columns
    for (let j = 0; j < 3; j++) {
        if (isPlayer(grid[0][j]) && grid[0][j] === grid[1][j] && grid[1][j] === grid[2][j]) {
            return grid[0][j]!;
        }
    }

    // Check diagonals
    if (isPlayer(grid[0][0]) && grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) {
        return grid[0][0];
    }
    if (isPlayer(grid[0][2]) && grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) {
        return grid[0][2];
    }

    // Check for draw (all cells filled)
    const isDraw = grid.every((row) => row.every((cell) => cell !== 'none'));
    if (isDraw) {
        return 'draw';
    }

    return 'none';
};

const setBit = (bitboard: number, x: number, y: number): number => {
    let index = x + y * 3;
    return bitboard | (1 << index);
};

const unsetBit = (bitboard: number, x: number, y: number): number => {
    let index = x + y * 3;
    return bitboard & ~(1 << index);
};

const getBit = (bitboard: number, x: number, y: number): number => {
    let index = x + y * 3;
    return (bitboard >> index) & 1;
};

const isBitboardWinning = (bitboard: number): boolean => {
    return (
        (bitboard & 0b111000000) === 0b111000000 ||
        (bitboard & 0b000111000) === 0b000111000 ||
        (bitboard & 0b000000111) === 0b000000111 ||
        (bitboard & 0b100100100) === 0b100100100 ||
        (bitboard & 0b010010010) === 0b010010010 ||
        (bitboard & 0b001001001) === 0b001001001 ||
        (bitboard & 0b100010001) === 0b100010001 ||
        (bitboard & 0b001010100) === 0b001010100
    );
};

const bitboardGridResult = (xBitboard: number, yBitboard: number): GameOutcome => {
    const xWin = isBitboardWinning(xBitboard);
    const yWin = isBitboardWinning(yBitboard);

    if (xWin) {
        return 'X';
    }
    if (yWin) {
        return 'O';
    }

    // if all cells filled, it's a draw
    if ((xBitboard | yBitboard) === 0b111111111) {
        return 'draw';
    }

    return 'none';
};

export interface GameState {
    aSubgridBitboard: number[];
    bSubgridBitboard: number[];
    // Subgrid to place in, can be any after filled it
    activeSubgrid: Coordinate | 'any';
    playerToMove: Player;
    complete: boolean;

    // list of moves so far, needed for mcts
    moves: Move[];
}

export const initialGameState: GameState = {
    // note subgrid bitboard are stored by columns
    // |x  |
    // | x | -> 0b 100 010 00 1
    // |  x|
    aSubgridBitboard: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    bSubgridBitboard: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    activeSubgrid: 'any',
    playerToMove: 'X',
    complete: false,
    moves: [],
};

export interface Move {
    coordinate: Coordinate;
    player: Player;

    // For easier undo
    currentSubgrid: Coordinate;
}

export class Game {
    currentState: GameState;

    constructor(state?: GameState) {
        this.currentState = state || structuredClone(initialGameState);
    }

    reset() {
        this.currentState = structuredClone(initialGameState);
    }

    copy(): Game {
        return new Game(structuredClone(this.currentState));
    }

    checkWinSubgrid(subgrid: Coordinate): GameOutcome {
        const idx = subgrid[0] + subgrid[1] * 3;
        const xBitboard = this.currentState.aSubgridBitboard[idx];
        const yBitboard = this.currentState.bSubgridBitboard[idx];
        return bitboardGridResult(xBitboard, yBitboard);
    }

    checkWinWholeBoard(): GameOutcome {
        let xWinsBitboard = 0;
        let yWinsBitboard = 0;
        let neutralBitboard = 0;
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                const subgridResult = this.checkWinSubgrid([x, y]);
                if (subgridResult === 'X') {
                    xWinsBitboard = setBit(xWinsBitboard, x, y);
                } else if (subgridResult === 'O') {
                    yWinsBitboard = setBit(yWinsBitboard, x, y);
                } else if (subgridResult === 'draw') {
                    neutralBitboard = setBit(neutralBitboard, x, y);
                }
            }
        }

        // check if a player already won
        const playerResult = bitboardGridResult(xWinsBitboard, yWinsBitboard);
        if (isPlayer(playerResult)) {
            return playerResult;
        }

        // otherwise, either all the subgrids are occupied with a winner
        // (which the bitboardGridResult accounts, returning 'draw')
        // or there is neutral territory, which this function checks for
        if (
            playerResult === 'draw' ||
            (xWinsBitboard | yWinsBitboard | neutralBitboard) === 0b111111111
        ) {
            return 'draw';
        }

        return 'none';
    }

    /**
     * Does a move, updating the game state
     * Checks if the tile is already occuied or if the move is in the wrong subgrid
     */
    doMove(move: Move) {
        const { coordinate, player } = move;
        const { aSubgridBitboard, bSubgridBitboard, activeSubgrid } = this.currentState;

        // check if the move is in the active subgrid
        const subgridX = Math.floor(coordinate[0] / 3);
        const subgridY = Math.floor(coordinate[1] / 3);

        // update the active subgrid to match the coordinate of the move
        // calculate the coordinates within the subgrid
        const offsetX = move.coordinate[0] % 3;
        const offsetY = move.coordinate[1] % 3;

        const idx = subgridX + subgridY * 3;
        const xBitboard = aSubgridBitboard[idx];
        const yBitboard = bSubgridBitboard[idx];

        const tile = this.getTile(coordinate);
        if (tile !== null) {
            debugger;
            throw new Error(`Tile already taken by ${tile}`);
        }

        if (activeSubgrid !== 'any' && !coordinatesEqual(activeSubgrid, [subgridX, subgridY])) {
            throw new Error('Move is not in the active subgrid');
        }

        this.currentState.moves.push(move);

        // update the game state
        if (player === 'X') {
            this.currentState.aSubgridBitboard[idx] = setBit(xBitboard, offsetX, offsetY);
        } else {
            this.currentState.bSubgridBitboard[idx] = setBit(yBitboard, offsetX, offsetY);
        }

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
        this.currentState.moves.pop();
        // remove the placed tile
        const subgridX = Math.floor(coordinate[0] / 3);
        const subgridY = Math.floor(coordinate[1] / 3);
        const offsetX = coordinate[0] % 3;
        const offsetY = coordinate[1] % 3;
        const idx = subgridX + subgridY * 3;
        const xBitboard = this.currentState.aSubgridBitboard[idx];
        const yBitboard = this.currentState.bSubgridBitboard[idx];

        if (player === 'X') {
            this.currentState.aSubgridBitboard[idx] = unsetBit(xBitboard, offsetX, offsetY);
        } else {
            this.currentState.bSubgridBitboard[idx] = unsetBit(yBitboard, offsetX, offsetY);
        }
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

        const { activeSubgrid } = this.currentState;

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

    getTile(coordinate: Coordinate): Tile {
        const { aSubgridBitboard, bSubgridBitboard } = this.currentState;
        const subgridX = Math.floor(coordinate[0] / 3);
        const subgridY = Math.floor(coordinate[1] / 3);

        const idx = subgridX + subgridY * 3;
        const xBitboard = aSubgridBitboard[idx];
        const yBitboard = bSubgridBitboard[idx];

        const x = coordinate[0] % 3;
        const y = coordinate[1] % 3;
        if (getBit(xBitboard, x, y)) {
            return 'X';
        }
        if (getBit(yBitboard, x, y)) {
            return 'O';
        }
        return null;
    }

    legalMovesSubgrid(subgrid: Coordinate): Move[] {
        const { aSubgridBitboard, bSubgridBitboard } = this.currentState;
        const idx = subgrid[0] + subgrid[1] * 3;
        const xBitboard = aSubgridBitboard[idx];
        const yBitboard = bSubgridBitboard[idx];

        const legalMoves: Move[] = [];
        for (let offsetX = 0; offsetX < 3; offsetX++) {
            for (let offsetY = 0; offsetY < 3; offsetY++) {
                if (getBit(xBitboard, offsetX, offsetY) || getBit(yBitboard, offsetX, offsetY)) {
                    continue;
                }
                legalMoves.push({
                    coordinate: [subgrid[0] * 3 + offsetX, subgrid[1] * 3 + offsetY],
                    player: this.currentState.playerToMove,
                    currentSubgrid: subgrid,
                });
            }
        }

        return legalMoves;
    }

    hash() {
        return this.currentState.moves.map((move) => move.coordinate.join(move.player)).join(' ');
    }

    onMove(move: Move) {
        // to be overriden
    }
}
