// Module 4.3, part 1: node:http on its own. No ERP, no data, no API call.
//
// Start:  npx tsx 04_module/minimal-http-server.ts
// Then, from a second terminal:  curl -i http://127.0.0.1:4000/hello
// Stop:   Ctrl+C in the terminal the server runs in.

import { createServer, type ServerResponse } from "node:http";

const PORT = 4000;

// createServer takes one function and calls it once per incoming request,
// with the request and a response object for the function to
// fill in. There is no routing: every request lands here, whatever its
// method and path.
const server = createServer((request, response) => {
    console.log("Incoming request");
    console.log(request.method, request.url);

    // request.url holds only what comes after host and port, for example
    // "/hello?name=Felix". new URL() needs a full address to parse that, so
    // it gets a base; only the path and the query are read from the result.
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/hello") {
        // searchParams.get returns null when the query has no "name".
        const name = url.searchParams.get("name") ?? "Welt";
        sendJson(response, 200, { message: `Hallo ${name}` });
        return;
    }

    // Any other method or path.
    sendJson(response, 404, { error: "not found" });
});

// Status code and header are set first; response.end() sends them together
// with the body and finishes the response. Without response.end() the client
// keeps waiting for more.
function sendJson(
    response: ServerResponse,
    status: number,
    body: unknown,
) {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(body));
}

// 127.0.0.1 is this machine itself: no other computer can reach the
// server. The callback runs once the port is open. From then on the
// process keeps running and waits for requests until it is stopped.
server.listen(PORT, "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${PORT}`);
});