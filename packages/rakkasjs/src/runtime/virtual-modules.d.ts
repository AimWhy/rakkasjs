declare module "virtual:rakkasjs:api-routes" {
	type Handler = import("@hattip/core").Handler;

	const routes: Array<[RegExp, [EndpointImporter, ...MiddlewareImporter[]]]>;

	type EndpointImporter = () => Promise<Endpoint>;
	type MiddlewareImporter = () => Promise<Middleware>;

	type Endpoint =
		| Record<string, Handler>
		| { default: Record<string, Handler> };

	type Middleware = { default: Handler };

	export default routes;
}

declare module "virtual:rakkasjs:server-page-routes" {
	const routes: Array<
		[
			regexp: RegExp,
			importers: [PageImporter, ...LayoutImporter[]],
			ids: string[],
		]
	>;

	type PageImporter = () => Promise<PageModule>;
	type LayoutImporter = () => Promise<LayoutModule>;

	type PageModule = import("./page-types").PageModule;
	type LayoutModule = import("./page-types").LayoutModule;

	export default routes;
}

declare module "virtual:rakkasjs:client-page-routes" {
	const routes: Array<
		[regexp: RegExp, importers: [PageImporter, ...LayoutImporter[]]]
	>;

	type PageImporter = () => Promise<PageModule>;
	type LayoutImporter = () => Promise<LayoutModule>;

	type PageModule = import("./page-types").PageModule;
	type LayoutModule = import("./page-types").LayoutModule;

	export default routes;
}

declare module "virtual:rakkasjs:client-manifest" {
	const manifest: undefined | import("vite").Manifest;
	export default manifest;
}
