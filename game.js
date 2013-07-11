"use strict";

// ensure there is a 'window.requestAnimationFrame', giving precedence to
// the built-in function(s).
window.requestAnimationFrame = (function(){
    return window.requestAnimationFrame || 
	window.webkitRequestAnimationFrame || 
	window.mozRequestAnimationFrame || 
	window.oRequestAnimationFrame || 
	window.msRequestAnimationFrame || 
	function(callback, element){
	    window.setTimeout(callback, 1000/60);
	};
})();


// make the canvas fit in the entire window...
function fitToWindow() {
    var canvas = document.getElementById("snake_canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.setAttribute('width', window.innerWidth);
    canvas.setAttribute('height', window.innerHeight);
    canvas.style.width = (window.innerWidth) + 'px';
    canvas.style.height = (window.innerHeight) + 'px';
}
fitToWindow();
// ...and have it adjust to changes in window size
(function() {
    window.addEventListener("resize", resizeThrottler, false);
    var resizeTimeout;
    function resizeThrottler() {
	if ( !resizeTimeout ) {
	    resizeTimeout = window.setTimeout(function() {
		resizeTimeout = null;
		fitToWindow();
	    }, 33);
	}
    }
})();


function uuid() {
    function s4() {
	return Math.floor((1 + Math.random()) * 0x10000)
	    .toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
	s4() + '-' + s4() + s4() + s4();
}



/**
 * A Snake object represents a single snake that exists in a discrete xy plane
 * of integers.  A snake consists of a head and a tail, with the head
 * occupying a single coordinate at the tip of the snake.  The snake can move
 * NORTH, SOUTH, EAST, or WEST.  A snake starts out with a length of 1.  When
 * it grows, the length of the snake does not increase until it moves.  That
 * is, if the snake grows by 4 units, the length of the snake will not increase
 * by four units until it moves 4 units.
 * @constructor
 * @param {number} [startx=0] The starting x coordinate of the snake
 * @param {number} [starty=0] The starting y coordinate of the snake
 * @param {string} [direction="NORTH"] The starting direction of the snake
 */
function Snake(id, infls, startdir) {
    // verify the integrity of the arguments
    if (typeof infls === 'undefined')
	infls = [{x:0,y:0}];
    if (Object.prototype.toString.call(infls) !== '[object Array]')
	throw "'infls' is not a valid array";
    if (infls.length < 1)
	infls = [{x:0,y:0}];
    if (typeof startdir === 'undefined')
        startdir = "NORTH";
    if (["NORTH", "EAST", "SOUTH", "WEST"].indexOf(startdir) < 0)
	throw "'startdir' is not string NORTH, EAST, SOUTH, or WEST";
    // initialize the inflection points to just the head
    var dataref = new Firebase('https://game-snake.firebaseio.com/snakes/'+id),
	inflections = infls,
	// initialize the direction of the snake
	direction = startdir,
        nextdirection = direction,
	// create a function that lists the snake's coordinates head->tail
	generateCoords = function() {
	    // go through each inflection point to get all the coordinates
	    var coords = [];
	    for (var i = 0; i < inflections.length-1; i++) {
		var x, y, mentor;
		// if the two inflection points are the same, move on
		if (inflections[i].x === inflections[i+1].x &&
		    inflections[i].y === inflections[i+1].y) {
		    continue;
		}
		// push the inflection point
		coords.push({x: inflections[i].x, y: inflections[i].y});
		if (inflections[i].x === inflections[i+1].x) {
		    // process the y deltas
		    x = inflections[i].x;
		    // determine direction
		    mentor = (inflections[i].y > inflections[i+1].y ? -1 : 1);
		    // push the inbetween coordinates
		    for (y = inflections[i].y + mentor;
			 y !== inflections[i+1].y;
			 y += mentor) {
			coords.push({x: x, y: y});
		    }
		} else {
		    // process the x deltas
		    y = inflections[i].y;
		    // determine direction
		    mentor = (inflections[i].x > inflections[i+1].x ? -1 : 1);
		    // push the inbetween coordinates
		    for (x = inflections[i].x + mentor;
			 x !== inflections[i+1].x;
			 x += mentor) {
			coords.push({x: x, y: y});
		    }
		}
		
	    }		
	    coords.push({x: inflections[inflections.length-1].x,
			 y: inflections[inflections.length-1].y});
	    return coords;
	},
	// initialize the length of the snake based on the inflection points
	length = generateCoords().length,
	// initialize the snake's pending growth to 0
	growth = 0;
    dataref.onDisconnect().remove();
    //dataref.push(inflections[0]);
    dataref.set(inflections);
    /**
     * Obtain the coordinates of the snake's head.
     * @returns {object} The (x,y) position of the snake's head
     */
    this.getHead = function() {
        return {x: inflections[0].x, y: inflections[0].y};
    };
    /**
     * Obtain the coordinates that make up the length of the snake.
     * @return {object[]} An array of (x,y) coordinates, with first element
     *                    indicating the position of the snake's head and the
     *                    last the tip of its tail
     */
    this.getCoords = function() {
	return generateCoords();
    };
    this.getLength = function() {
        return length;
    };
    /**
     * Determine if an xy coordinate is occupied by any part of the snake.
     * @param {number} x The x-coordinate
     * @param {number} y The y-coordinate
     * @param {boolean} [head=true] True if the head of the snake should be
     *                              included in the check, false if not
     * @returns {boolean|undefined} The result is undefined if the x or y
     * coordinate is not a number, otherwise returns true if the snake
     * occupies the coordinate and false if it does not
     */
    this.occupies = function(x, y, head) {
	if (typeof x !== 'number' || typeof y !== 'number')
	    return undefined;
        if (head === 'undefined')
            head = true;
        if (typeof head !== 'boolean')
            return undefined;
	x = Math.floor(x);
	y = Math.floor(y);
	var coords = generateCoords();
	for (var i = (head ? 0 : 1); i < coords.length; i++) {
	    if (coords[i].x === x && coords[i].y === y) {
		return true;
            }
	}
	return false;
    };
    /**
     * Set the direction that the snake is travelling in.  Valid directions are
     * "NORTH", "EAST", "SOUTH", and "WEST".
     * @param {string} dir The direction to attempt to make the snake travel in
     * @returns {string} The direction in which the snake will travel next
     */
    this.setDirection = function(dir) {
	if (typeof dir !== 'string')
	    return nextdirection;
	// make sure the turn is valid
        if ((direction === "NORTH" && (dir === "EAST" || dir === "WEST")) ||
            (direction === "SOUTH" && (dir === "EAST" || dir === "WEST")) ||
            (direction === "EAST" && (dir === "NORTH" || dir === "SOUTH")) ||
            (direction === "WEST" && (dir === "NORTH" || dir === "SOUTH"))) {
	    // set the new direction of the snake
            nextdirection = dir;
        }
        return nextdirection;
    };
    /**
     * Cause the snake to grow some number of units in length.  Note that the
     * snake cannot shrink.
     * @param {number} [units=1] The number of units to grow
     * @returns {number} The eventual length of the snake (its current actual
     *                   length plus all pending growth after this call)
     */
    this.grow = function(units) {
	if (typeof units === 'undefined')
	    units = 1;
	if (typeof units !== 'number')
	    return length + growth;
	units = Math.floor(units);
	if (units < 1)
	    return length + growth;
	// increase the pending growth
	growth += units;
	return length + growth;
    };
    /**
     * Cause the snake to move some number of units, changing the position of
     * its head and allowing it to grow if it needs to.
     * @param {number} [steps=1] The number of steps to move the snake
     * @returns {object} The (x,y) position of the snake's head
     */
    this.move = function(steps) {
	// validate the argument
	if (typeof steps === 'undefined')
	    steps = 1;
	if (typeof steps !== 'number')
	    return {x: inflections[0].x, y: inflections[0].y};
	steps = Math.floor(steps);
	if (steps < 1)
	    return {x: inflections[0].x, y: inflections[0].y};
        // set the direction
        var changedDirection = (direction !== nextdirection);
        direction = nextdirection;
        if (changedDirection) {
	    // add a corner to the snake
	    inflections.unshift({x:inflections[0].x,y:inflections[0].y});
	    dataref.set(inflections);
        }
	// move the head
        var lasthead = {x: inflections[0].x, y: inflections[0].y};
        if (direction === "NORTH")
	    inflections[0].y -= steps;
        else if (direction === "SOUTH")
	    inflections[0].y += steps;
        else if (direction === "EAST")
	    inflections[0].x += steps;
        else if (direction === "WEST")
	    inflections[0].x -= steps;
	dataref.child(0).set(inflections[0]);
	// stop if just a head
	if (inflections.length === 1) {
            // if we can grow, grow once
            if (growth > 0) {
                if (!changedDirection) {
                    inflections.push(lasthead);
		    dataref.child(inflections.length-1).set(lasthead);
		}
                growth -= 1;
                length += 1;
            }
	    return {x: inflections[0].x, y: inflections[0].y};
        }
	// clean up the tail
	for (var s = 0; s < steps; s++) {
	    // check if the tail needs to grow
	    if (growth > 0) {
		growth -= 1;
		length += 1;
		continue;
	    }
	    // the tail needs to move one unit
	    var last = inflections.length-1;
	    if (inflections[last].x === inflections[last-1].x) {
		if (inflections[last].y > inflections[last-1].y) {
		    inflections[last].y -= 1;
		} else {
		    inflections[last].y += 1;
		}
	    } else {
		if (inflections[last].x > inflections[last-1].x) {
		    inflections[last].x -= 1;
		} else {
		    inflections[last].x += 1;
		}
	    }
	    dataref.child(last).set(inflections[last]);
	    // if the tail reaches a corner, remove the corner
	    if (inflections[last].x === inflections[last-1].x &&
		inflections[last].y === inflections[last-1].y) {
		inflections.pop();
		dataref.child(last).remove();
	    }
	}
	return {x: inflections[0].x, y: inflections[0].y};
    };
}


function ReadableSnake(id) {
    var dataref = new Firebase('https://game-snake.firebaseio.com/snakes/'+id),
	inflections = undefined,
	coords = undefined,
	generateCoords = function() {
	    if (typeof coords !== 'undefined')
		return coords;
	    if (typeof inflections === 'undefined' || inflections.length < 1)
		return [];
	    // go through each inflection point to get all the coordinates
	    coords = [];
	    for (var i = 0; i < inflections.length-1; i++) {
		var x, y, mentor;
		// if the two inflection points are the same, move on
		if (inflections[i].x === inflections[i+1].x &&
		    inflections[i].y === inflections[i+1].y) {
		    continue;
		}
		// push the inflection point
		coords.push({x: inflections[i].x, y: inflections[i].y});
		if (inflections[i].x === inflections[i+1].x) {
		    // process the y deltas
		    x = inflections[i].x;
		    // determine direction
		    mentor = (inflections[i].y > inflections[i+1].y ? -1 : 1);
		    // push the inbetween coordinates
		    for (y = inflections[i].y + mentor;
			 y !== inflections[i+1].y;
			 y += mentor) {
			coords.push({x: x, y: y});
		    }
		} else {
		    // process the x deltas
		    y = inflections[i].y;
		    // determine direction
		    mentor = (inflections[i].x > inflections[i+1].x ? -1 : 1);
		    // push the inbetween coordinates
		    for (x = inflections[i].x + mentor;
			 x !== inflections[i+1].x;
			 x += mentor) {
			coords.push({x: x, y: y});
		    }
		}
		
	    }		
	    coords.push({x: inflections[inflections.length-1].x,
			 y: inflections[inflections.length-1].y});
	    return coords;
	};
    dataref.on('value', function(snapshot) {
	var val = snapshot.val();
	if (val === null) {
	    inflections = undefined;
	    return;
	}
        inflections = val;
    });
    dataref.on('child_added', function(snapshot) {
	var name = parseInt(snapshot.name());
	var val = snapshot.val();
	inflections[name] = {x: val.x, y: val.y};
	coords = undefined;
    });
    dataref.on('child_removed', function(snapshot) {
	var name = parseInt(snapshot.name());
	inflections.splice(name, 1);
	coords = undefined;
    });
    dataref.on('child_changed', function(snapshot) {
	var name = parseInt(snapshot.name());
	var val = snapshot.val();
	inflections[name] = {x: val.x, y: val.y};
	coords = undefined;
    });
    this.getLength = function() {
	return generateCoords().length;
    };
    this.getHead = function() {
	if (this.getLength() < 1)
	    return undefined;
	return generateCoords()[0];
    };
    this.getCoords = function() {
	return generateCoords();
    };
    this.occupies = function(x, y, head) {
	if (typeof x !== 'number' || typeof y !== 'number')
	    return undefined;
        if (typeof head === 'undefined')
            head = true;
        if (typeof head !== 'boolean')
            return undefined;
	x = Math.floor(x);
	y = Math.floor(y);
	var coords = generateCoords();
	for (var i = (head ? 0 : 1); i < coords.length; i++) {
	    if (coords[i].x === x && coords[i].y === y) {
		return true;
            }
	}
	return false;
    };
}


function Snakes() {
    var dataref = new Firebase('https://game-snake.firebaseio.com/snakes');
    var pid = uuid();
    var player = new Snake(pid, [{x:0,y:0}], "NORTH");
    var comrades = {};
    var marc;
    dataref.on("child_added", function(snapshot) {
	var name = snapshot.name();
	if (name !== pid) {
            if (name === 'marcrepert') {
                marc = new ReadableSnake(name);
            } else {
                comrades[name] = new ReadableSnake(name);
            }
        }
    });
    dataref.on("child_removed", function(snapshot) {
	delete comrades[snapshot.name()];
    });
    this.getPlayer = function() { return player; };
    this.getComrades = function() {
	var valids = [];
	for (var comrade in comrades)
	    if (comrades[comrade].getLength() > 0)
		valids.push(comrades[comrade]);
	return valids;
    };
    this.getMarc = function() { return marc; };
}


function Snacks() {
    var bounds = {min: {x: -64, y: -64},
                  max: {x: 64, y: 64}},
        snacks = {},
        dataref = new Firebase('https://game-snake.firebaseio.com/snacks'),
        generateSnack = function() {
            var x = Math.floor(Math.random() *
                               (bounds.max.x - bounds.min.x + 1)) +
                    bounds.min.x,
                y = Math.floor(Math.random() *
                               (bounds.max.y - bounds.min.y + 1)) +
                    bounds.min.y;
            for (var i = 0; i < snacks; i++) {
                if (snacks[i].x === x && snacks[i].y === y) {
                    this.generateSnack();
                    return;
                }
            }
            var snack = {x: x, y: y};
            dataref.push(snack);
        };
    dataref.on("child_added", function(snapshot) {
        snacks[snapshot.name()] = snapshot.val();
    });
    dataref.on("child_removed", function(snapshot) {
        delete snacks[snapshot.name()];
    });
    /**
     * Get the (x,y) coordinates of all the snacks in no particular order.
     * @returns {object[]} An array of all the snack positions
     */
    this.getSnackPositions = function() {
        var positions = [];
        for (var snack in snacks)
            positions.push({x: snacks[snack].x, y: snacks[snack].y});
        return positions;
    };
    /**
     * Attempt to consume a snack at the specified location.
     * @param {number} x The x-coordinate at which to consume
     * @param {number} y The y-coordinate at which to consume
     * @returns {boolean} true if a snack was consumed, false if there was no
     *                    snack at the specified location
     */
    this.consume = function(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number')
            return false;
        x = Math.floor(x);
        y = Math.floor(y);
        for (var snack in snacks) {
            if (snacks[snack].x === x && snacks[snack].y === y) {
                dataref.child(snack).remove();
                generateSnack();
                return true;
            }
        }
        return false;
    };
    /*
    this.setBounds = function(xmin, ymin, xmax, ymax) {
        if (typeof xmin !== 'number' || typeof ymin !== 'number' ||
            typeof xmax !== 'number' || typeof ymax !== 'number')
            return {min: {x: bounds.min.x, y: bounds.min.y},
                    max: {x: bounds.max.x, y: bounds.max.y}};
        xmin = Math.floor(xmin);
        ymin = Math.floor(ymin);
        xmax = Math.floor(xmax);
        ymax = Math.floor(ymax);
        if (xmin > xmax || ymin > ymax)
            return {min: {x: bounds.min.x, y: bounds.min.y},
                    max: {x: bounds.max.x, y: bounds.max.y}};
        bounds = {min: {x: xmin, y: ymin},
                  max: {x: xmax, y: ymax}};
        return {min: {x: bounds.min.x, y: bounds.min.y},
                max: {x: bounds.max.x, y: bounds.max.y}};
    };
     */
}





function GraphicsManager(canvas) {
    if (typeof canvas === 'undefined')
	throw "'canvas' object is not a valid canvas";
    var context = canvas.getContext('2d'),
	camera = {x: 0, y: 0},
	pixelscale = 16;
    //context.strokeStyle = "#000";
    this.setCameraPosition = function(x, y) {
	if (typeof x !== 'number' || typeof y !== 'number')
	    return {x: camera.x, y: camera.y};
	x = Math.floor(x);
	y = Math.floor(y);
	camera = {x: x, y: y};
	return {x: camera.x, y: camera.y};
    };
    this.clearScreen = function() {
	context.fillStyle = '#000';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#FFF';
    };
    this.drawPixel = function(x, y, colour) {
	if (typeof x !== 'number' || typeof y !== 'number')
	    return false;
        if (typeof colour === 'undefined')
            colour = "#FFF";
        if (typeof colour !== 'string')
            return false;
	x = Math.floor(x) - camera.x;
	y = Math.floor(y) - camera.y;
	var canvaspixel = {x: canvas.width / 2 - pixelscale / 2,
			   y: canvas.height / 2 - pixelscale / 2};
	var camerapixel = {x: canvaspixel.x,
			   y: canvaspixel.y};
        context.fillStyle = colour;
	context.fillRect(camerapixel.x + x * pixelscale - 0.5,
			 camerapixel.y + y * pixelscale - 0.5,
			 pixelscale-1, pixelscale-1);
	return true;
    };
    this.drawScores = function(scores) {
        if (typeof scores !== 'object' || scores.length === undefined)
            return false;
        context.font = "16pt Arial";
        context.fillStyle = "#FFF";
        context.fillText("Your Score: " + scores[0], 8, 32);
        context.font = "12pt Arial";
        if (scores.length > 1) {
            var best = 0;
            for (var s = 1; s < scores.length; s++) {
                if (scores[s] > best)
                    best = scores[s];
            }
            context.fillText("Best Enemy: " + best, 8, 48);
        }
        context.fillText("Snake Champion: Marc Repert (445)", 8, 64);
    };
}



/**
 * A Game object represents an entire snake game.
 * @constructor
 * @param {object} canvas A canvas DOM element that the game will hijack
 *                        and use to interact with the user
 */
function Game(canvas) {
    var context = canvas.getContext('2d');
    var gm = new GraphicsManager(canvas);
    var snakes = new Snakes();
    var snacks = new Snacks();
    var playing = true;
    // making the element tabable makes it selectable
    if (canvas.getAttribute('tabindex') === null || 
	canvas.getAttribute('tabindex') === 'undefined')
	canvas.setAttribute("tabindex", 1);
    if (canvas.getAttribute('tabIndex') === null || 
	canvas.getAttribute('tabIndex') === 'undefined')
	canvas.setAttribute("tabIndex", 1);
    canvas.addEventListener("keydown", function(event) {
        if (event.preventDefault)
            event.preventDefault();
        if (event.stopPropagation)
            event.stopPropagation();
	if (event.keyCode === 87 || event.keyCode === 38) { // W
	    snakes.getPlayer().setDirection("NORTH");
        }
        else if (event.keyCode === 65 || event.keyCode === 37) { // A
	    snakes.getPlayer().setDirection("WEST");
        }
        else if (event.keyCode === 83 || event.keyCode === 40) { // S
	    snakes.getPlayer().setDirection("SOUTH");
        }
        else if (event.keyCode == 68 || event.keyCode === 39) { // D
	    snakes.getPlayer().setDirection("EAST");
        }
    });
    (function update() {
        var i;
        window.setTimeout(update, 1000.0/24.0);
        if (!playing)
            return;
        var playerhead = snakes.getPlayer().move(1);
	var comrades = snakes.getComrades();
        // check for a crash
        if (snakes.getPlayer().occupies(playerhead.x, playerhead.y, false)) {
            playing = false;
	    //window.location.href = 'http://en.m.wikipedia.org/wiki/Failure';
            return;
        }
	for (i = 0; i < comrades.length; i++) {
            if (comrades[i].occupies(playerhead.x, playerhead.y)) {
                playing = false;
	        //window.location.href = 'http://en.m.wikipedia.org/wiki/Failure';
                return;
            }
	}
        // check for a snack
        var consumed = snacks.consume(playerhead.x, playerhead.y);
        if (consumed) {
            snakes.getPlayer().grow(1);
        }
    })();
    (function draw() {
        var i, j;
	window.requestAnimationFrame(draw);
        var playercoords = snakes.getPlayer().getCoords();
	gm.clearScreen();
	gm.setCameraPosition(playercoords[0].x, playercoords[0].y);
        var marc = snakes.getMarc();
        if (marc) {
            var coordsmarc = marc.getCoords();
            for (i = 0; i < coordsmarc.length; i++)
                gm.drawPixel(coordsmarc[i].x, coordsmarc[i].y, "#111");
        }
        var snackposs = snacks.getSnackPositions();
        for (i = 0; i < snackposs.length; i++) {
            gm.drawPixel(snackposs[i].x, snackposs[i].y);
        }
	var comrades = snakes.getComrades();
	for (i = 0; i < comrades.length; i++) {
	    var comradecoords = comrades[i].getCoords();
	    for (j = 0; j < comradecoords.length; j++)
		gm.drawPixel(comradecoords[j].x, comradecoords[j].y, "#999");
	}
        for (i = 0; i < playercoords.length; i++)
	    gm.drawPixel(playercoords[i].x, playercoords[i].y, "#777");
        var scores = [playercoords.length];
        for (i = 0; i < comrades.length; i++)
            scores.push(comrades[i].getLength());
        gm.drawScores(scores);
    })();
}
