// Explanation of the expected operation.
// 1. user navigates to the website's url
// 2. server responds with index.html, which loads main.js
// 3. main.js will poll for new JSON data every so often,
//    and the server will respond with the data.

// main.js is effectively a 'web app' served up on navigation to
// the website's url.
// main.js is able to request new data from the server by sending
// a GET request to the server's /update endpoint. This is just a
// way for the server to know what the client wants, and to respond to
// the client with the requested file or data.

// my_url should be the url that clients see in their address bar.
// The purpose is to set Access-Control-Allow-Origin so that only
// requests coming from that url are accepted, rather than accepting
// any ('*') host's request.
const my_url = 'http://localhost:8000';
const csvPath = './NpcProviderExport.csv';
const port = 8000;

// How long to wait between regular attempts
// to reread the csv file. Currently 8 minutes.
// (unit is milliseconds)
const time_between_csv_reloads = 8 * 60 * 1000;



const http = require('http');
const fs = require('fs');
const path = require('path');

let g_data = {};

const server = http.createServer(async (req, res) => {
    try {
        switch (req.url) {
            case '/': {
                const content = await fs.promises.readFile(path.join(__dirname, 'index.html'));
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(content);
            } break;
            case '/main.js': {
                const content = await fs.promises.readFile(path.join(__dirname, 'main.js'));
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                res.end(content);
            } break;
            case '/style.css': {
                const content = await fs.promises.readFile(path.join(__dirname, 'style.css'));
                res.writeHead(200, {'Content-Type': 'text/css'});
                res.end(content);
                } break;
            case '/background.png': {
                const content = await fs.promises.readFile(path.join(__dirname, 'background.png'));
                res.writeHead(200, {'Content-Type': 'image/png'});
                res.end(content);
            } break;
            case '/update': {
                const content = JSON.stringify(g_data);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': `${my_url}`
                });
                res.end(content);
            } break;
            default: {
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end('<h1>404 Not Found</h1>');
            }
        }
    } catch (error) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end("Internal server error");
        const now = new Date();
        console.log(`${now}: {error}`);
    }
});

server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

function loadCSV() {
    let lines = fs.readFileSync(csvPath, 'utf-8').split("\n");
    let region_tag = "#REGION#";
    let data = {};
    previous_row_was_section = false;
    let section = undefined;
    for (let line of lines) {
        if (line.startsWith(region_tag)) {
            section = line.slice(region_tag.length, -2);
            data[section] = {section};
            previous_row_was_section = true;
        } else if (previous_row_was_section) {
            previous_row_was_section = false;
            let cols = line.trim().split(',');
            data[section]['columns'] = cols;
            data[section]['rows'] = [];
        } else {
            let cols = line.trim().split(',');
            for (let i = 0; i < cols.length; ++i) {
                switch (cols[i]) {
                    case "True": cols[i] = true; break;
                    case "False": cols[i] = false; break;
                    default:
                        let f = parseFloat(cols[i]);
                        if (!isNaN(f) && !cols[i].includes(' ')) {
                            cols[i] = f;
                        }
                }
            }
            data[section]['rows'].push(cols);
        }
    }
    g_data = data;
}



loadCSV();

setInterval(() => {
    loadCSV();
    const now = new Date();
    console.log(`${now}: Reloaded CSV file.`);
}, time_between_csv_reloads);

const now = new Date();
console.log(`${now}: Starting server.`);
server.listen(port);