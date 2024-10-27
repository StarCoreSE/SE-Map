// Change these paths if necessary
let backgroundImagePath = "background.png"

const apiUrl = 'http://5.9.80.176:8000/update'; 
const pollingInterval = 8 * 60 * 1000; // 8 minutes


let g_data = undefined;

const backgroundImage = new Image();
let loaded = false;

const canvas = document.querySelector(".myCanvas");
var width = canvas.clientWidth;
var height = canvas.clientHeight;
canvas.width = width;
canvas.height = height;
const c = canvas.getContext("2d");

let camera = {x: 0, y: 0};
let offset = {x: width/2, y: height/2};
let cameraNext = {x: camera.x, y: camera.y};

let warningMessage = "";
let warningMessageTime = 0;

calculateCanvasResolution();

let isPlaying = true;

let mouseX = 0;
let mouseY = 0;



let trackedTargetId = undefined;

let zoom = 1.0;
let zoomNext = zoom;

let options = {
	showNames: true,
};

let recording;

let isAnimate = true;

function worldToScreen(x, y) {
	x = (x - camera.x) * zoom + offset.x;
	y = (y - camera.y) * zoom + offset.y;
	return {x, y};
}

function screenToWorld(x, y) {
	x = (x - offset.x) / zoom + camera.x;
	y = (y - offset.y) / zoom + camera.y;
	return {x, y};
}

function clear() {
	if (loaded) {
		c.fillStyle = "#000";
		c.fillRect(0, 0, width, height);
		
		let scale = 300000
        // These offsets in world space are to center the background image
		let S = worldToScreen(5000000, 2000000);
		let w = backgroundImage.width * (scale * zoom);
		let h = backgroundImage.height * (scale * zoom);
		c.drawImage(backgroundImage, S.x - w/2, S.y - h/2, w, h);
	} else {
		c.fillStyle = "#003";
		c.fillRect(0, 0, width, height);
	}
}

function init() {
    backgroundImage.src = backgroundImagePath;
    backgroundImage.onload = () => { loaded = true; }

}

let previousTimeStamp;
function animate(timeStamp) {
	if (previousTimeStamp === undefined) {
		previousTimeStamp = timeStamp;
	}
	const dt = timeStamp - previousTimeStamp;
	requestAnimationFrame(animate);
	clear();
	if(isAnimate)
		update(dt);
	draw(dt);
	previousTimeStamp = timeStamp;
}

function update(dt) {}

let scrubber = 0.0;

function lerp(v0, v1, t) {
	return v0*(1-t)+v1*t
}

function drawGrid() {
	let S = worldToScreen(0, 0);
	let x = S.x;
	let y = S.y;
	c.strokeStyle = "green";
	// vertical
	c.beginPath();
	c.moveTo(x,0);
	c.lineTo(x,height);
	c.stroke();
	
	c.lineWidth = 1;
	// horizontal
	c.beginPath();
	c.moveTo(0,y);
	c.lineTo(width,y);
	c.stroke();
}

function drawRings() {
    // Update the rings so that the largest one is 200,000 km (200,000,000 meters)
    let rings = [50000000, 200000000]; // Radii in meters
    let ringColor = "green";
    let p = worldToScreen(0, 0); // Center the rings
    let x = p.x;
    let y = p.y;

    c.strokeStyle = ringColor;
    for (radius of rings) {
        c.beginPath();
        c.lineWidth = 1;
        c.arc(x, y, radius * zoom, 0, Math.PI * 2, false); // Draw each ring, scaled by zoom
        c.stroke();
        let pad = 4;
        c.fillStyle = ringColor;
        if (zoom * radius > 50) {
            c.fillText((radius / 1000) + " km", x + radius * zoom + pad, y - pad); // Display radius label in km
        }
    }
    c.setLineDash([]);
}

let cachedScreenPositions = [];

function getFactionColor(faction, alpha) {
    faction_cols = g_data.FACTIONS.columns;
    for (let i = 0; i < g_data.FACTIONS.rows.length; ++i) {
        faction_row = g_data.FACTIONS.rows[i];
        let tag = faction_row[faction_cols.indexOf('FactionTag')];
        if (tag == faction) {
            let color = faction_row[faction_cols.indexOf('Color')];
            // TODO: proper spengies color to real color format here
            let comps = color.split(' ').map(comp => Math.abs(parseFloat(comp) * 255));
            return `rgba(${comps[0]}, ${comps[1]}, ${comps[2]}, ${alpha})`;
        }
    }
    return 'white';
}

function generateGpsList() {
    if (!g_data || !g_data.ECONOMY) {
        console.error("Economy data not available.");
        return;
    }

    const gpsEntries = [];
    const cols = g_data.ECONOMY.columns;
    const nameIndex = cols.indexOf('Name');
    const xIndex = cols.indexOf('X');
    const yIndex = cols.indexOf('Y');
    const zIndex = cols.indexOf('Z');
    
    for (let i = 0; i < g_data.ECONOMY.rows.length; ++i) {
        const entry = g_data.ECONOMY.rows[i];
        const name = entry[nameIndex];
        const x = entry[xIndex].toFixed(2); // Adjust decimals as needed
        const y = entry[yIndex].toFixed(2);
        const z = entry[zIndex].toFixed(2);

        const gpsString = `GPS:${name}:${x}:${y}:${z}:#FFFFA1B6:`;
        gpsEntries.push(gpsString);
    }

    return gpsEntries.join('\n');
}

function copyGpsListToClipboard() {
    const gpsList = generateGpsList();
    if (!gpsList) {
        console.error("No GPS data available to copy.");
        return;
    }

    // Create a temporary textarea element to hold the text
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = gpsList;
    document.body.appendChild(tempTextArea);

    // Select the text and copy it
    tempTextArea.select();
    tempTextArea.setSelectionRange(0, 99999); // For mobile devices
    try {
        document.execCommand("copy");
        console.log("GPS list copied to clipboard!");
        buttonText = "GPS list copied!"; // Update the button text for feedback
        setTimeout(() => {
            buttonText = "Copy GPS List"; // Revert after 2 seconds
            draw(); // Redraw to update button text
        }, 2000);
    } catch (err) {
        console.error("Failed to copy GPS list:", err);
        buttonText = "Copy failed!";
        setTimeout(() => {
            buttonText = "Copy GPS List"; // Revert after 2 seconds
            draw(); // Redraw to update button text
        }, 2000);
    }

    // Remove the temporary textarea element
    document.body.removeChild(tempTextArea);
    draw(); // Redraw to immediately show feedback
}


const buttonX = 10;
const buttonY = 10;
const buttonWidth = 150;
const buttonHeight = 30;

let buttonText = "Copy GPS List"; // Initial button text

function drawButton() {
    c.fillStyle = "#444"; // Button background color
    c.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    c.fillStyle = "#FFF"; // Button text color
   // c.font = "14px Arial";
    c.fillText(buttonText, buttonX + 15, buttonY + 20); // Adjust text position as needed
}

function drawEconomy() {
    let radius = 5;
    
    let cols = g_data.ECONOMY.columns;
    for (let i = 0; i < g_data.ECONOMY.rows.length; ++i) {
        let r = g_data.ECONOMY.rows[i];
        let X = r[cols.indexOf('X')];
        let Y = r[cols.indexOf('Z')];
        let p = worldToScreen(X, Y);
        let x = p.x;
        let y = p.y;
        let name = r[cols.indexOf('Name')];
        
        let faction = r[cols.indexOf('Faction')];
        let fill = getFactionColor(faction, 1.0);
        
        // circles
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2, false);
        c.fillStyle = fill;
        c.fill();
        
        // names
        let xoff = 4;
        let yoff = 4;
        c.fillText(name, x + xoff + radius, y + yoff - radius);
        let xf = Math.floor(X / 1000)
        let yf = Math.floor(Y / 1000)
        c.fillText(`X: ${xf} Z: ${yf} km`, x + xoff + radius, y - yoff - radius);
    }
}

function drawTerritory() {
    let cols = g_data.TERRITORY.columns;
    for (let i = 0; i < g_data.TERRITORY.rows.length; ++i) {
        let r = g_data.TERRITORY.rows[i];
        let X = r[cols.indexOf('X')];
        let Y = r[cols.indexOf('Z')];
        let radius = r[cols.indexOf('Radius')] * zoom;
        
        let p = worldToScreen(X, Y);
        let x = p.x;
        let y = p.y;
        let name = r[cols.indexOf('Name')];
        
        let faction = r[cols.indexOf('Faction')];
        let fill = getFactionColor(faction, 0.4);
        
        // circles
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2, false);
        c.fillStyle = fill;
        c.fill();
        
        // names
        let xoff = 4;
        let yoff = 4;
        c.fillText(name, x + xoff + radius, y + yoff - radius);
    }
}

function draw(dt) {
    zoom = lerp(zoom, zoomNext, 0.05125);
    
    drawGrid();
    drawRings();
    if (g_data) {
        drawTerritory();
        drawEconomy();
    }

    drawButton(); // Draw the button after other elements
}



function calculateCanvasResolution() {
	width = canvas.clientWidth;
	height = canvas.clientHeight;
	canvas.width = width;
	canvas.height = height;
	offset = {x: width/2, y: height/2};
}

clear();
init();
animate();

function sq(n) { return n * n; }
let dragStartPosition = null;
let cameraPrv = camera;
canvas.addEventListener("mousedown", (e) => {
	let S = {x: mouseX, y: mouseY};
	let hitRadius = 100;
	for (let i = 0; i < cachedScreenPositions.length; ++i) {
		let p = cachedScreenPositions[i];
		let squaredDistance = sq(S.x-p.x) + sq(S.y-p.y);
		if (squaredDistance < hitRadius) {
			trackedTargetId = p.entityId;
			offset.x = width/2;
			offset.y = height/2;
			return;
		}
	}
	trackedTargetId = undefined;

	cameraPrv = {x: camera.x, y: camera.y};
	dragStartPosition = {x: mouseX, y: mouseY};
});

canvas.addEventListener("mouseup", (e) => {
	if (dragStartPosition) {
		camera.x = cameraPrv.x + (dragStartPosition.x - mouseX) / zoom;
		camera.y = cameraPrv.y + (dragStartPosition.y - mouseY) / zoom;
		dragStartPosition = null;
	}
});

let zoomLevels = [1, 1/2, 1/8, 1/32, 1/128, 1/512, 1/2048, 1/4096, 1/16384, 1/32768, 1/65536, 1/131072, 1/262144, 1/524288];
let zoomIndex = 13;

zoom = zoomLevels[zoomIndex];
zoomNext = zoom;

canvas.addEventListener("wheel", e => {
    e.preventDefault();
    let scrollDelta = e.deltaY > 0 ? 1 : -1;
    let prvZoomIndex = zoomIndex;
    zoomIndex += scrollDelta;

    if (zoomIndex < 0) zoomIndex = 0;
    if (zoomIndex >= zoomLevels.length) zoomIndex = zoomLevels.length - 1;

    let prvZoom = zoom;
    zoomNext = zoomLevels[zoomIndex];

    if (prvZoomIndex === zoomIndex) return;
	
	// if the camera is tracking something, don't try to zoom-to-cursor
	if (trackedTargetId !== undefined) return;
	
	// Get the world point that is under the mouse
    let M = screenToWorld(mouseX, mouseY);

    // Set the offset to where the mouse is
    offset.x = mouseX;
	offset.y = mouseY;

    // Set the target to match, so that the camera maps the world space point 
    // under the cursor to the screen space point under the cursor at any zoom
    camera.x = M.x;
	camera.y = M.y;
	
}, { passive: false });

window.onresize = calculateCanvasResolution;

canvas.addEventListener("mousemove", function(e) { 
	let cRect = canvas.getBoundingClientRect();
	let canvasX = Math.round(e.clientX - cRect.left);
	let canvasY = Math.round(e.clientY - cRect.top);
	c.clearRect(0, 0, canvas.width, canvas.height);
	c.fillStyle = "green";
	c.fillText("X: "+canvasX+", Y: "+canvasY, 10, 20);
	mouseX = canvasX;
	mouseY = canvasY;
	if (dragStartPosition) {
		camera.x = cameraPrv.x + (dragStartPosition.x - mouseX) / zoom;
		camera.y = cameraPrv.y + (dragStartPosition.y - mouseY) / zoom;
	}
});

canvas.addEventListener("click", function(e) {
    let cRect = canvas.getBoundingClientRect();
    let clickX = e.clientX - cRect.left;
    let clickY = e.clientY - cRect.top;
    
    // Check if the click is within the button bounds
    if (clickX >= buttonX && clickX <= buttonX + buttonWidth &&
        clickY >= buttonY && clickY <= buttonY + buttonHeight) {
        copyGpsListToClipboard();
    }
});

function pollServer(url, interval) {
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Process the data received from the server
      console.log(data);
      
      g_data = data;

      // Schedule the next poll
      setTimeout(() => pollServer(url, interval), interval);
    })
    .catch(error => {
      console.error('Error polling server:', error);

      // Retry polling after a delay
      setTimeout(() => pollServer(url, interval), interval);
    });
}

pollServer(apiUrl, pollingInterval);