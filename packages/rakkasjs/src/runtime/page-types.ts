import { ComponentType, ReactNode } from "react";
import {
	QueryClient,
	PageContext,
	RedirectProps,
	ResponseHeadersProps,
	RequestContext,
} from "../lib";

export type PageImporter = () => Promise<PageModule>;

export type LayoutImporter = () => Promise<LayoutModule>;

export interface PageModule {
	default: Page;
	headers?: HeadersFunction;
	prerender?: PrerenderFunction;
}

export interface LayoutModule {
	default: Layout;
	headers?: HeadersFunction;
	prerender?: PrerenderFunction;
}

/** A page component default exported from a page module */
export type Page<
	P = Record<string, string>,
	M = Record<string, unknown>,
> = ComponentType<PageProps<P, M>> & {
	/** Function to be called before rendering the page */
	preload?: PreloadFunction<P, M>;
};

/** A layout component default exported from a layout module. */
export type Layout<
	P = Record<string, string>,
	M = Record<string, unknown>,
> = ComponentType<LayoutProps<P, M>> & {
	/** Function to be called before rendering the layout */
	preload?: PreloadFunction<P, M>;
};

/** Props passed to a page component */
export interface PageProps<
	P = Record<string, string>,
	M = Record<string, unknown>,
> {
	/** Current URL */
	url: URL;
	/** Route parameters */
	params: P;
	/** Page meta data coming from the preload functions */
	meta: M;
}

/** Props passed to a layout component */
export interface LayoutProps<
	P = Record<string, string>,
	M = Record<string, unknown>,
> extends PageProps<P, M> {
	children: ReactNode;
}

/** Function to be called before each time loading a page or layout.
 *
 * Usage:
 * ```
 * 	MyPageOrLayoutComponent.preload = (context: PreloadContext) => {
 * 		return {
 * 			meta: {
 * 				someKey: "Some metadata to be passed to the pages and layouts",
 * 			},
 * 			head: <Head title="My Page Title" />,
 * 		};
 * 	};
 * ```
 * You can also handle redirections by returning a
 * {@link PreloadResult.redirect redirect} prop.
 */
export type PreloadFunction<
	P = Record<string, string>,
	M = Record<string, unknown>,
> = (
	context: PreloadContext<P>,
) => PreloadResult<M> | void | Promise<PreloadResult<M> | void>;

/** Arguments passed to the preload function */
export interface PreloadContext<P = Record<string, string>>
	extends PageContext {
	/** Query client for accessing the query cache */
	queryClient: QueryClient;
	/** Current URL */
	url: URL;
	/** Route parameters */
	params: P;
}

/**
 * Arguments passed to server-side page functions like `headers`,
 * `prerender`, and `action`
 */
export type ServerSidePageContext<P = Record<string, string>> =
	PreloadContext<P> & {
		requestContext: RequestContext;
	};

/** Return type of a preload function */
export interface PreloadResult<M = Record<string, unknown>> {
	/** Metadata passed to page and layout components. */
	meta?: Partial<M>;
	/** Head tags rendered for the page. Use the <Head /> component. */
	head?: ReactNode;
	/** Redirection */
	redirect?: RedirectProps;
}

export interface PageRouteGuardContext<P = Record<string, string>>
	extends PageContext {
	/** Dynamic path parameters */
	params: P;
}

/** Type for the default export of page guards */
export type PageRouteGuard<P = Record<string, string>> = (
	ctx: PageRouteGuardContext<P>,
) => boolean;

/** Function to set response headers */
export type HeadersFunction<M = Record<string, unknown>> = (
	context: ServerSidePageContext,
	meta: M,
) => ResponseHeadersProps | Promise<ResponseHeadersProps>;

/** Function to control static prerendering behavior */
export type PrerenderFunction<M = Record<string, unknown>> = (
	context: ServerSidePageContext,
	meta: M,
) => PrerenderResult | Promise<PrerenderResult>;

/** Return type of the prerender function */
export interface PrerenderResult {
	/** Should this page be prerendered? Defaults to true */
	shouldPrerender?: boolean;
	/** Should the prerenderer crawl this page? Defaults to the value of prerender */
	shouldCrawl?: boolean;
	/** More links to prerender */
	links?: (URL | string)[];
}
