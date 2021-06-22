import fs from "fs";
import path from "path";
import { build } from "esbuild";
import type { Config, FullConfig } from "../..";

export interface ConfigConfig {
	filename?: string;
	root?: string;
}

let query = 0;

export async function loadConfig(configConfig: ConfigConfig = {}): Promise<{
	config: FullConfig;
	deps: string[];
}> {
	configConfig.root = configConfig.root ?? process.cwd();
	const filename = findConfigFile(configConfig);
	if (!filename) {
		return { config: withDefaults({}), deps: [] };
	}

	console.log("Loading config from", filename);
	const { outfile, deps } = await buildFile(filename, configConfig.root);

	console.log(outfile + `?${query++}`);
	let loaded = await import(outfile + `?${query++}`);

	// Poor man's esModuleInterop
	while (loaded.default) loaded = loaded.default;

	if (typeof loaded === "function") {
		loaded = await loaded();
	}

	return {
		config: withDefaults(loaded),
		deps,
	};
}

function findConfigFile(configConfig: ConfigConfig) {
	let { filename } = configConfig;

	if (!filename) {
		const candidates = [
			CONFIG_BASE_NAME + ".js",
			CONFIG_BASE_NAME + ".ts",
			CONFIG_BASE_NAME + ".mjs",
		].map((fn) => path.resolve(configConfig.root!, fn));

		const found = candidates.find((fn) => fs.existsSync(fn));
		if (!found) {
			return undefined;
		}

		filename = found;
	}

	return filename;
}

async function buildFile(filename: string, root: string) {
	const outfile = path.resolve(
		root,
		"node_modules/.rakkas",
		"rakkas.config.cjs",
	);

	const buildResult = await build({
		entryPoints: [filename],
		outfile,
		bundle: true,
		write: true,
		platform: "node",
		format: "cjs",
		metafile: true,
		plugins: [
			{
				name: "external-deps",
				setup(build) {
					build.onResolve({ filter: /.*/ }, ({ path: name }) => {
						if (
							name[0] !== "." &&
							name !== "@rakkasjs/cli" &&
							!path.isAbsolute(name)
						) {
							return {
								external: true,
							};
						}
					});
				},
			},
		],
	});

	return {
		outfile,
		deps: Object.keys(buildResult.metafile!.inputs).map((fn) =>
			path.resolve(fn),
		),
	};
}

function withDefaults(config: Config): FullConfig {
	const out = {
		vite: {},
		pagesDir: "pages",
		pageExtensions: ["jsx", "tsx"],
		apiDir: "api",
		apiRoot: "/api",
		endpointExtensions: ["js", "ts"],
		...config,
	};

	return out;
}

const CONFIG_BASE_NAME = "rakkas.config";
