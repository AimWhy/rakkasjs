import React, { StrictMode, Suspense } from "react";
import { hydrateRoot } from "react-dom/client";
import { DEFAULT_QUERY_OPTIONS } from "../features/use-query/implementation";
import {
	UseQueryOptions,
	PageContext,
	ErrorBoundary,
	LookupHookResult,
} from "../lib";
import { App, loadRoute, RouteContext } from "./App";
import { ClientHooks } from "./client-hooks";
import featureHooks from "./feature-client-hooks";
import { IsomorphicContext } from "./isomorphic-context";
import ErrorComponent from "virtual:rakkasjs:error-page";
import commonHooks from "virtual:rakkasjs:common-hooks";

export type { ClientHooks };

/** Options passed to {@link startClient} */
export interface StartClientOptions {
	/** Default options for {@link useQuery} hooks */
	defaultQueryOptions?: UseQueryOptions;
	/** Client hooks */
	hooks?: ClientHooks;
}

/** Starts the client. */
export async function startClient(options: StartClientOptions = {}) {
	Object.assign(DEFAULT_QUERY_OPTIONS, options.defaultQueryOptions);

	const clientHooks = options.hooks
		? [...featureHooks, options.hooks]
		: featureHooks;

	for (const hooks of clientHooks) {
		if (hooks.beforeStart) {
			await hooks.beforeStart();
		}
	}

	const pageContext: PageContext = {
		url: new URL(window.location.href),
		locals: {},
	} as any;
	for (const hooks of clientHooks) {
		await hooks.extendPageContext?.(pageContext);
	}
	await commonHooks.extendPageContext?.(pageContext);

	const beforePageLookupHandlers: Array<
		(ctx: PageContext, url: URL) => LookupHookResult
	> = [commonHooks.beforePageLookup].filter(Boolean) as any;

	let app = (
		<IsomorphicContext.Provider value={pageContext}>
			<App beforePageLookupHandlers={beforePageLookupHandlers} />
		</IsomorphicContext.Provider>
	);

	const reverseHooks = [...clientHooks].reverse();
	for (const hooks of reverseHooks) {
		if (hooks.wrapApp) {
			app = hooks.wrapApp(app);
		}
	}

	if (commonHooks.wrapApp) {
		app = commonHooks.wrapApp(app);
	}

	history.replaceState(
		{
			...history.state,
			actionData: (window as any).$RAKKAS_ACTION_DATA,
		},
		"",
	);

	const route = await loadRoute(
		pageContext,
		undefined,
		true,
		beforePageLookupHandlers,
		(window as any).$RAKKAS_ACTION_DATA,
	).catch((error) => {
		return { error };
	});

	app = (
		<RouteContext.Provider value={"error" in route ? route : { last: route }}>
			<Suspense>
				<ErrorBoundary FallbackComponent={ErrorComponent}>{app}</ErrorBoundary>
			</Suspense>
		</RouteContext.Provider>
	);

	if (import.meta.env.DEV && process.env.RAKKAS_STRICT_MODE === "true") {
		app = <StrictMode>{app}</StrictMode>;
	}

	hydrateRoot(document.getElementById("root")!, app);
}
