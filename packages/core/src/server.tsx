import React from "react";
import { renderToString } from "react-dom/server";
import { ServerRouter } from "bare-routes";
import devalue from "devalue";
import { RawRequest, RakkasRequest } from "./types";

import {
	EndpointModule,
	findEndpoint,
	MiddlewareModule,
	RequestHandler,
} from "./endpoints";

import nodeFetch, {
	Response as NodeFetchResponse,
	Request as NodeFetchRequest,
	Headers as NodeFetchHeaders,
	// @ts-expect-error: There's a problem with node-fetch typings
} from "node-fetch";
import type { RakkasResponse } from "./types";
import { makeComponentStack, StackResult } from "./makeComponentStack";
import { HeadContext, HeadContent } from "./HeadContext";
import { escapeHTML } from "./Head";

globalThis.fetch = nodeFetch;
globalThis.Response = NodeFetchResponse;
globalThis.Request = NodeFetchRequest;
globalThis.Headers = NodeFetchHeaders;

export async function handleRequest(
	req: RawRequest,
	template: string,
): Promise<RakkasResponse> {
	const found = findEndpoint(req);

	let method = req.method.toLowerCase();
	if (method === "delete") method = "del";

	if (found) {
		let handler: RequestHandler | undefined;

		const endpointModule = (await found.stack[
			found.stack.length - 1
		]()) as EndpointModule;

		const leaf = endpointModule[method] || endpointModule.default;

		if (leaf) {
			const middleware = found.stack.slice(0, -1) as Array<
				() => Promise<MiddlewareModule>
			>;

			handler = middleware.reduceRight((prev, cur) => {
				return async (req: RakkasRequest) => {
					const mdl = await cur();
					return mdl.default(req, prev);
				};
			}, leaf);

			return handler({ ...req, params: found.params, context: {} });
		}
	}

	if (req.method !== "GET") {
		return {
			status: 404,
		};
	}

	function renderPage(foundPage: StackResult) {
		const headContent: HeadContent = {};

		const app = renderToString(
			<HeadContext.Provider value={headContent}>
				<ServerRouter url={req.url}>{foundPage.content}</ServerRouter>
			</HeadContext.Provider>,
		);

		let head = `<script>__RAKKAS_INITIAL_DATA=${devalue(
			foundPage.data,
		)}</script><script>__RAKKAS_INITIAL_CONTEXT=${devalue(
			foundPage.contexts,
		)}</script>`;

		if (headContent.title) {
			head += `<title data-rakkas-head>${escapeHTML(
				headContent.title,
			)}</title>`;
		}

		let body = template.replace("<!-- rakkas-head-placeholder -->", head);

		body = body.replace("<!-- rakkas-app-placeholder -->", app);

		return {
			status: foundPage.status,
			headers: {
				"content-type": "text/html",
			},
			body,
		};
	}

	function myFetch(
		input: RequestInfo,
		init?: RequestInit,
	): Promise<NodeFetchResponse> {
		let url: string;
		let fullInit: Omit<RequestInit, "headers"> & { headers: Headers };
		if (input instanceof Request) {
			url = input.url;
			fullInit = {
				body: input.body,
				cache: input.cache,
				credentials: input.credentials,
				integrity: input.integrity,
				keepalive: input.keepalive,
				method: input.method,
				mode: input.mode,
				redirect: input.redirect,
				referrer: input.referrer,
				referrerPolicy: input.referrerPolicy,
				signal: input.signal,
				...init,
				headers: new Headers(init?.headers ?? input.headers),
			};
		} else {
			url = input;
			fullInit = {
				...init,
				headers: new Headers(init?.headers),
			};
		}

		const parsed = new URL(url, req.url);

		if (parsed.origin === req.url.origin) {
			if (fullInit.credentials !== "omit") {
				const cookie = req.headers.get("cookie");
				if (cookie !== null) {
					fullInit.headers.set("cookie", cookie);
				}

				const authorization = req.headers.get("authorization");
				if (!fullInit.headers.has("authorization") && authorization !== null) {
					fullInit.headers.set("authorization", authorization);
				}
			}
		}

		[
			"referer",
			"x-forwarded-for",
			"x-forwarded-host",
			"x-forwarded-proto",
			"x-forwarded-server",
		].forEach((header) => {
			if (req.headers.has(header)) {
				fullInit.headers.set(header, req.headers.get(header)!);
			}
		});

		if (req.headers.has("referer")) {
			fullInit.headers.set("referer", req.headers.get("referer")!);
		}

		if (
			!fullInit.headers.has("accept-language") &&
			req.headers.has("accept-language")
		) {
			fullInit.headers.set(
				"accept-language",
				req.headers.get("accept-language")!,
			);
		}

		return nodeFetch(parsed.href, fullInit);
	}

	const foundPage = await makeComponentStack({
		url: req.url,
		previousRender: {
			components: [],
			isDataValid: [],
			data: [],
			contexts: [],
		},

		reload() {
			throw new Error("Don't call reload on server side");
		},

		fetch: myFetch,
	});

	// Handle redirection
	if ("location" in foundPage) {
		return {
			status: foundPage.status,
			headers: {
				location: String(foundPage.location),
			},
		};
	}

	return renderPage(foundPage);
}
