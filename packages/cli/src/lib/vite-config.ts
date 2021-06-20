import reactRefresh from "@vitejs/plugin-react-refresh";
import path from "path";
import virtual, { invalidateVirtualModule } from "vite-plugin-virtual";
import micromatch from "micromatch";
import type { InlineConfig } from "vite";
import { FullConfig } from "../..";

export function makeViteConfig(
	config: FullConfig,
	configDeps: string[],
	onConfigChange?: () => void,
): InlineConfig {
	const srcDir = path.resolve("src");
	const publicDir = path.resolve("public");

	const componentExtensions = config.pageExtensions.join("|");
	const PAGES = `/${config.pagesDir}/**/(*.)?page.(${componentExtensions})`;
	const LAYOUTS = `/${config.pagesDir}/**/(*/)?layout.(${componentExtensions})`;

	const apiExtensions = config.endpointExtensions.join("|");
	const ENDPOINTS = `/${config.apiDir}/**/(*.)?endpoint.(${apiExtensions})`;
	const MIDDLEWARE = `/${config.apiDir}/**/(*/)?middleware.(${apiExtensions})`;

	const isPage = micromatch.matcher(path.join(srcDir, PAGES));
	const isLayout = micromatch.matcher(path.join(srcDir, LAYOUTS));

	const isEndpoint = micromatch.matcher(path.join(srcDir, ENDPOINTS));
	const isMiddleware = micromatch.matcher(path.join(srcDir, MIDDLEWARE));

	const pagesAndLayouts =
		`export const pages = import.meta.glob(${JSON.stringify(PAGES)});` +
		`export const layouts = import.meta.glob(${JSON.stringify(LAYOUTS)});`;

	const endpointsAndMiddleware =
		`export const endpoints = import.meta.glob(${JSON.stringify(ENDPOINTS)});` +
		`export const middleware = import.meta.glob(${JSON.stringify(
			MIDDLEWARE,
		)});`;

	const virtualModules = virtual({
		"@rakkasjs/pages-and-layouts": pagesAndLayouts,
		"@rakkasjs/endpoints-and-middleware": endpointsAndMiddleware,
	});

	return {
		...config.vite,
		configFile: false,
		root: srcDir,
		publicDir,
		define: {
			__RAKKAS_CONFIG: {
				pagesDir: config.pagesDir,
				apiDir: config.apiDir,
				apiRoot: config.apiRoot,
			},
		},
		server: {
			...config.vite.server,
			middlewareMode: "ssr",
		},
		plugins: [
			reactRefresh(),
			virtualModules,
			{
				name: "rakkas-resolve",
				enforce: "pre",

				configureServer(server) {
					server.watcher.addListener("all", (e: string, fn: string) => {
						if (
							(isPage(fn) || isLayout(fn)) &&
							(e === "add" || e === "unlink")
						) {
							invalidateVirtualModule(server, "@rakkasjs/pages-and-layouts");
						} else if (
							(isEndpoint(fn) || isMiddleware(fn)) &&
							(e === "add" || e === "unlink")
						) {
							invalidateVirtualModule(
								server,
								"@rakkasjs/endpoints-and-middleware",
							);
						} else if (configDeps.includes(fn) && onConfigChange) {
							console.log("Config file dependency", fn, "changed");
							onConfigChange();
						}
					});
				},

				buildStart() {
					console.log("Build starting");
					this.addWatchFile(path.join(srcDir, PAGES));
					this.addWatchFile(path.join(srcDir, LAYOUTS));
					this.addWatchFile(path.join(srcDir, ENDPOINTS));
					this.addWatchFile(path.join(srcDir, MIDDLEWARE));

					if (onConfigChange) {
						configDeps.forEach((dep) => this.addWatchFile(dep));
					}
				},

				async resolveId(id, importer) {
					// Avoid infinite loop
					if (importer === "@rakkasjs") return undefined;

					if (id === "/client" && !(await this.resolve(id, "@rakkasjs"))) {
						return id;
					} else if (id === "@rakkasjs/server") {
						const result = (await this.resolve("/server", "@rakkasjs")) || id;
						console.log(result);
						return result;
					} else if (id === path.resolve("src/index.html")) {
						return id;
					}
				},

				async load(id) {
					if (id === "/client") {
						return `import { startClient } from "rakkasjs/client"; startClient();`;
					} else if (id === "@rakkasjs/server") {
						return `export getRootContext:()=>({})`;
					} else if (id === path.resolve("src/index.html")) {
						return template;
					}
				},
			},

			...(config.vite.plugins || []),
		],
	};
}

const template = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta http-equiv="X-UA-Compatible" content="ie=edge" />
		<!-- rakkas-head-placeholder -->
	</head>
	<body>
		<div id="rakkas-app"><!-- rakkas-app-placeholder --></div>
		<script type="module" src="/client"></script>
	</body>
</html>`;
