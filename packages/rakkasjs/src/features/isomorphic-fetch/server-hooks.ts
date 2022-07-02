import hattipHandler from "virtual:rakkasjs:hattip-entry";
import type { ServerHooks } from "../../runtime/hattip-handler";

const isomorphicFetchServerHooks: ServerHooks = {
	middleware: {
		beforePages: (ctx) => {
			ctx.fetch = async (input, init) => {
				let url: URL | undefined;

				if (!(input instanceof Request)) {
					url = new URL(input, ctx.url);
					input = url.href;
				}

				const newRequest = new Request(input, init);
				url = url || new URL(newRequest.url, ctx.url);

				const sameOrigin = url.origin === ctx.url.origin;
				const includeCredentials =
					newRequest.credentials === "include" ||
					(newRequest.credentials === "same-origin" && sameOrigin);

				if (includeCredentials) {
					const cookie = ctx.request.headers.get("cookie");
					if (cookie !== null) {
						newRequest.headers.set("cookie", cookie);
					}

					const authorization = ctx.request.headers.get("authorization");
					if (authorization !== null) {
						newRequest.headers.set("authorization", authorization);
					}
				} else {
					// Node fetch doesn't honor the credentials property
					newRequest.headers.delete("cookie");
					newRequest.headers.delete("authorization");
				}

				let response: Response | undefined | null;

				if (sameOrigin) {
					response = await hattipHandler({
						request: newRequest,
						ip: ctx.ip,
						waitUntil: ctx.waitUntil,
						passThrough: ctx.passThrough,
						platform: ctx.platform,
					});
				}

				return response ?? fetch(newRequest);
			};
		},
	},

	createPageHooks(ctx) {
		return {
			extendPageContext(pageContext) {
				pageContext.fetch = ctx.fetch;
			},
		};
	},
};

export default isomorphicFetchServerHooks;
