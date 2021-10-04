#!/usr/bin/env node
import { createServer } from "http";
import fs from "fs";
import path from "path";
import sirv from "sirv";
import { parseBody } from "./parse-body.js";
import nodeFetch, {
	Response as NodeFetchResponse,
	Request as NodeFetchRequest,
	Headers as NodeFetchHeaders,
} from "node-fetch";
import { pathToFileURL } from "url";
import { RakkasResponse } from "rakkasjs";

(globalThis as any).fetch = nodeFetch;
(globalThis as any).Response = NodeFetchResponse;
(globalThis as any).Request = NodeFetchRequest;
(globalThis as any).Headers = NodeFetchHeaders;

export async function startServer() {
	const rootDir = process.cwd();

	const apiRoutes = (
		await import(
			pathToFileURL(path.resolve(rootDir, "./dist/server/api-routes.js")).href
		)
	).default.default;

	const pageRoutes = (
		await import(
			pathToFileURL(path.resolve(rootDir, "./dist/server/page-routes.js")).href
		)
	).default.default;

	const { handleRequest } = (await import(
		pathToFileURL(path.resolve(rootDir, "./dist/server/server.js")).href
	)) as any;

	const manifest: Record<string, string[]> = JSON.parse(
		await fs.promises.readFile("./dist/rakkas-manifest.json", "utf-8"),
	);

	const template = await fs.promises.readFile("./dist/index.html", "utf-8");

	const fileServer = sirv("dist/client", { etag: true, maxAge: 0 });

	const trustForwardedOrigin = !!process.env.TRUST_FORWARDED_ORIGIN || false;
	const host = process.env.HOST || "localhost";
	const port = process.env.PORT || 3000;

	const app = createServer((req, res) => {
		const proto =
			(trustForwardedOrigin && req.headers["x-forwarded-proto"]) || "http";
		const host =
			(trustForwardedOrigin && req.headers["x-forwarded-host"]) ||
			req.headers.host ||
			"localhost";
		const ip =
			(trustForwardedOrigin && req.headers["x-forwarded-for"]) ||
			req.socket.remoteAddress;

		async function handle() {
			try {
				const { body, type } = await parseBody(req);

				const response: RakkasResponse = await handleRequest(
					apiRoutes,
					pageRoutes,
					{
						request: {
							ip,
							url: new URL(req.url || "/", `${proto}://${host}`),
							method: req.method || "GET",
							headers: new Headers(req.headers as Record<string, string>),
							type,
							body,
							originalIp: req.socket.remoteAddress,
							originalUrl: new URL(
								req.url || "/",
								`http://${req.headers.host || "localhost"}`,
							),
						},
						template,
						manifest,
						pages: pageRoutes,
					},
				);

				res.statusCode = response.status ?? 200;

				let headers = response.headers;
				if (!headers) headers = [];
				if (!Array.isArray(headers)) headers = Object.entries(headers);

				headers.forEach(([name, value]) => {
					if (value === undefined) return;
					res.setHeader(name, value);
				});

				if (
					response.body === null ||
					response.body === undefined ||
					response.body instanceof Uint8Array ||
					typeof response.body === "string"
				) {
					res.end(response.body);
				} else {
					res.end(JSON.stringify(response.body));
				}
			} catch (error) {
				console.error(error);
				res.statusCode = 500;
				res.end("Server error");
			}
		}

		if (req.url === "/") {
			handle();
		} else {
			fileServer(req, res, handle);
		}
	});

	app.listen({ port, host }, () => {
		if (process.argv.every((x) => x !== "-q" && x !== "--quiet")) {
			console.log(`Rakkas app listening on http://${host}:${port}`);
		}
	});
}

startServer();
