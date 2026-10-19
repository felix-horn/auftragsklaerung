// Module 4.3, part 1: node:http on its own. No ERP, no data, no API call.
//
// Start:  npx tsx 04_module/minimal-http-server.ts
// Then, from a second terminal:  curl -i http://127.0.0.1:4000/hello
// Stop:   Ctrl+C in the terminal the server runs in.

import { createServer, type ServerResponse } from "node:http";

const PORT = 4000;

// createServer takes one function and calls it once per incoming request,
// with the request (req) and a response object (res) for the function to
// fill in. There is no routing: every request lands here, whatever its
// method and path.
const server = createServer((req, res) => {
    console.log("Incoming request");
    console.log(req.method, req.url);

    // req.url holds only what comes after host and port, for example
    // "/hello?name=Felix". new URL() needs a full address to parse that, so
    // it gets a base; only the path and the query are read from the result.
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/hello") {
        // searchParams.get returns null when the query has no "name".
        const name = url.searchParams.get("name") ?? "Welt";
        sendJson(res, 200, { message: `Hallo ${name}` });
        return;
    }

    // Any other method or path.
    sendJson(res, 404, { error: "not found" });
});

// Status code and header are set first; res.end() sends them together
// with the body and finishes the response. Without res.end() the client
// keeps waiting for more.
function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
}

// 127.0.0.1 is this machine itself: no other computer can reach the
// server. The callback runs once the port is open. From then on the
// process keeps running and waits for requests until it is stopped.
server.listen(PORT, "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${PORT}`);
});