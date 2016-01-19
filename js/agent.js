// helper functions
// Qing Bai
function randomInt(n) {
    return Math.floor(Math.random() * n);
};

function AgentBrain(gameEngine) {
    this.size = 4;
    this.previousState = gameEngine.grid.serialize();
    this.reset();
    this.score = 0;
};

AgentBrain.prototype.reset = function () {
    this.score = 0;
    this.grid = new Grid(this.previousState.size, this.previousState.cells);
};

// Adds a tile in a random position
AgentBrain.prototype.addRandomTile = function () {
    if (this.grid.cellsAvailable()) {
        var value = Math.random() < 0.9 ? 2 : 4;
        var tile = new Tile(this.grid.randomAvailableCell(), value);

        this.grid.insertTile(tile);
    }
};

AgentBrain.prototype.moveTile = function (tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
AgentBrain.prototype.move = function (direction) {
    // 0: up, 1: right, 2: down, 3: left
    var self = this;

    var cell, tile;

    var vector = this.getVector(direction);
    var traversals = this.buildTraversals(vector);
    var moved = false;

    //console.log(vector);

    //console.log(traversals);

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach(function (x) {
        traversals.y.forEach(function (y) {
            cell = { x: x, y: y };
            tile = self.grid.cellContent(cell);

            if (tile) {
                var positions = self.findFarthestPosition(cell, vector);
                var next = self.grid.cellContent(positions.next);

                // Only one merger per row traversal?
                if (next && next.value === tile.value && !next.mergedFrom) {
                    var merged = new Tile(positions.next, tile.value * 2);
                    merged.mergedFrom = [tile, next];

                    self.grid.insertTile(merged);
                    self.grid.removeTile(tile);

                    // Converge the two tiles' positions
                    tile.updatePosition(positions.next);

                    // Update the score
                    self.score += merged.value;

                } else {
                    self.moveTile(tile, positions.farthest);
                }

                if (!self.positionsEqual(cell, tile)) {
                    moved = true; // The tile moved from its original cell!
                }
            }
        });
    });
    //console.log(moved);
//    if (moved) {
//        this.addRandomTile();
//    }
    return moved;
};

// Get the vector representing the chosen direction
AgentBrain.prototype.getVector = function (direction) {
    // Vectors representing tile movement
    var map = {
        0: { x: 0, y: -1 }, // Up
        1: { x: 1, y: 0 },  // Right
        2: { x: 0, y: 1 },  // Down
        3: { x: -1, y: 0 }   // Left
    };

    return map[direction];
};

// Build a list of positions to traverse in the right order
AgentBrain.prototype.buildTraversals = function (vector) {
    var traversals = { x: [], y: [] };

    for (var pos = 0; pos < this.size; pos++) {
        traversals.x.push(pos);
        traversals.y.push(pos);
    }

    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();

    return traversals;
};

AgentBrain.prototype.findFarthestPosition = function (cell, vector) {
    var previous;

    // Progress towards the vector direction until an obstacle is found
    do {
        previous = cell;
        cell = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(cell) &&
             this.grid.cellAvailable(cell));

    return {
        farthest: previous,
        next: cell // Used to check if a merge is required
    };
};

AgentBrain.prototype.positionsEqual = function (first, second) {
    return first.x === second.x && first.y === second.y;
};

function Agent() {
};

Agent.prototype.selectMove = function (gameManager) {
    var brain = new AgentBrain(gameManager);
    var expectedValues = [];
    var moved = false;
    var depth = 5;

    for (var i = 0; i < 4; i++) {
        moved = brain.move(i)

        if (moved) {
            expectedValues.push(this.expectiMax(brain, depth - 1, false));
            brain.reset();
        } else {
            expectedValues.push(-999999999999);
        }
    }
    
    var maxValue = Math.max.apply(null, expectedValues);
    return expectedValues.indexOf(maxValue);
};

Agent.prototype.expectiMax = function(brain, depth, isPlayer) {
    if (depth == 0 || !brain.grid.cellsAvailable()) {
        return this.evaluateGrid(brain.grid);
    }

    var previousScore = brain.score;
    var previousState = brain.grid.serialize();

    if (isPlayer) {
        var maxValue = -999999999999;
        var moved = false;

        for (var i = 0; i < 4; i++) {
            moved = brain.move(i);

            if (moved) {
                var value = this.expectiMax(brain, depth - 1, !isPlayer);
                maxValue = Math.max(value, maxValue);
                brain.grid = new Grid(previousState.size, previousState.cells);
                brain.score = previousScore;
            }
        }

        return maxValue;
    } else {
        var expectedValue = 0;
        var cells = brain.grid.availableCells();
        var size = cells.length;

        for (var i = 0; i < size; i++) {
            brain.grid.insertTile(new Tile(cells[i], 2));
            expectedValue += (1.0 / size) * 0.9 * this.expectiMax(brain, depth - 1, !isPlayer);
            brain.grid = new Grid(previousState.size, previousState.cells);
            brain.score = previousScore;
        }

        return expectedValue;
    }
};

Agent.prototype.evaluateGrid = function (gameBoard) {
    var cells = gameBoard.cells;
    var numOfTiles = 0;
    var tileValuesDiff = 0;
    var maxTileValue = 0;
    var maxX = 0;
    var maxY = 0;
    var cell = null;
    var tileBorderScore = 0;
    var largeTileNum = 0;

    for (var row = 0; row < 4; row++) {
        var rowTileValues = [];

        for (var col = 0; col < 4; col++) {
            cell = cells[row][col];

            if (cell != null) {
                numOfTiles++;
                rowTileValues.push(cell.value);

                if (cell.value > maxTileValue) {
                    maxTileValue = cell.value;
                    maxX = cell.x;
                    maxY = cell.y;
                }

                if (cell.value >= 128 && !this.isAtCenter(cell.x, cell.y)) {
                    tileBorderScore += cell.value;
                }

                if (cell.value > 32) {
                    largeTileNum++;
                }
            }
        }

        tileValuesDiff += this.calculateArrayDifference(rowTileValues);
    }

    for (var col = 0; col < 4; col++) {
        var colTileValues = [];

        for (var row = 0; row < 4; row++) {
            cell = cells[row][col];

            if (cell != null) {
                colTileValues.push(cell.value);
            }
        }

        tileValuesDiff += this.calculateArrayDifference(colTileValues);
    }

    maxTileValue = maxTileValue / 2;

    if (this.isAtCorner(maxX, maxY)) {
        return 5000 * (16 - numOfTiles) - 240 * tileValuesDiff + 50 * maxTileValue + 2 * tileBorderScore - 1600 * largeTileNum;
    } else {
        return 5000 * (16 - numOfTiles) - 240 * tileValuesDiff - 10 * maxTileValue + 2 * tileBorderScore - 1600 * largeTileNum;
    }
};

Agent.prototype.calculateArrayDifference = function (tileValues) {
    var isIncreased = true;
    var isDecreased = true;
    var difference = 0;

    for (var i = 0; i < tileValues.length - 1; i++) {
        isIncreased = isIncreased && (tileValues[i] <= tileValues[i + 1]);
        isDecreased = isDecreased && (tileValues[i] >= tileValues[i + 1]);
        var max = Math.max(tileValues[i], tileValues[i + 1]);
        var min = Math.min(tileValues[i], tileValues[i + 1]);
        difference += max / min;
    }

    if (isIncreased || isDecreased) {
        if (length == 3 && difference <= 4) {
            return -5 * (7 - difference);
        } else if (length == 4 && difference <= 6) {
            return -10 * (9 - difference);
        } else if (length == 3 && difference <= 12) {
            return -3 * (15 - difference);
        } else if (length == 4 && difference <= 18) {
            return -5 * (21 - difference);
        } else if (difference <= 30) {
            return -10;
        } else {
            return -5;
        }
    } else {
        if (difference < 10) {
            return difference;
        } else {
            return 3 * difference;
        }
    }
}

Agent.prototype.isAtCorner = function (x, y) {
    return (x == 0 && y == 0) || (x == 0 && y == 3) || (x == 3 && y == 0) || (x == 3 && y == 3);
}

Agent.prototype.isAtCenter = function (x, y) {
    return (x == 1 && y == 1) || (x == 1 && y == 2) || (x == 2 && y == 1) || (x == 2 && y == 2);
}