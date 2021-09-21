import path from "path";
import { InlineConfig, normalizePath, SSROptions } from "vite";
import { FullConfig } from "../..";
import { rakkasVitePlugin } from "./vite-plugin";

export interface ConfigFlavorOptions {
	configDeps?: string[];
	onConfigChange?: () => void;
	buildMode?: "ssr" | "static";
	stripLoadFunctions?: boolean;
}

export async function makeViteConfig(
	config: FullConfig,
	{
		configDeps,
		onConfigChange,
		buildMode = "ssr",
		stripLoadFunctions = false,
	}: ConfigFlavorOptions = {},
): Promise<InlineConfig> {
	const srcDir = normalizePath(path.resolve("src"));
	const publicDir = normalizePath(path.resolve("public"));
	const pagesDir = normalizePath(config.pagesDir);
	const apiDir = normalizePath(config.apiDir);

	const result: InlineConfig = {
		...config.vite,
		configFile: false,
		root: srcDir,
		publicDir,

		server: {
			...config.vite.server,
			middlewareMode: "ssr",
		},

		optimizeDeps: {
			...config.vite.optimizeDeps,
			exclude: [
				...(config.vite.optimizeDeps?.exclude || [
					"rakkasjs",
					"rakkasjs/server",
				]),
			],
			include: [
				...(config.vite.optimizeDeps?.include || []),
				"react",
				"react-dom",
				"react-dom/server",
				"react-helmet-async",
			],
		},

		resolve: {
			...config.vite.resolve,
			dedupe: [
				...(config.vite.resolve?.dedupe || []),
				"react",
				"react-dom",
				"react-dom/server",
				"react-helmet-async",
			],
		},
		plugins: [
			...(config.vite.plugins || []),
			await rakkasVitePlugin({
				srcDir,
				pagesDir,
				apiDir,
				pageExtensions: config.pageExtensions,
				endpointExtensions: config.endpointExtensions,
				apiRoot: config.apiRoot,
				configDeps,
				stripLoadFunctions,
				onConfigChange,
			}),
		],
		define: {
			...config.vite.define,
			RAKKAS_BUILD_MODE: JSON.stringify(buildMode),
		},
	};

	const ssrOptions: SSROptions = {
		noExternal: ["rakkasjs", "rakkasjs/server"],
	};

	// @ts-expect-error: SSR options are not in the type definitions yet
	result.ssr = ssrOptions;

	return result;
}
