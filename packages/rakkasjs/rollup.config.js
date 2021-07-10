import ts from "rollup-plugin-ts";
import nodeResole from "@rollup/plugin-node-resolve";
import cjs from "@rollup/plugin-commonjs";

const isProd = process.env.NODE_ENV === "production";

/** @type {import('rollup').RollupOptions[]} */
const options = [
	{
		input: [
			"src/index.tsx",
			"src/server.tsx",
			"src/client.tsx",
		],
		output: [
			{
				dir: "dist",
				format: "esm",
				chunkFileNames: "chunks/[name]-[hash].js",
				plugins: isProd
					? [
							// TODO: Investigate why terser breaks the build
							// terser()
					  ]
					: [],
			},
		],
		external: [
			"@rakkasjs/server-hooks",
			"@rakkasjs/client-hooks",

			"@rakkasjs/page-imports",
			"@rakkasjs/api-imports",

			"react",
			"react-dom",
			"react-dom/server",
			"react-helmet-async",
			"node-fetch",
		],
		plugins: [
			nodeResole(),
			cjs(),
			ts({
				transpiler: "babel",
				browserslist: [
					"last 2 and_chr versions",
					"last 2 android versions",
					"last 2 ios versions",
					"ios 12.1", // Still supported on old devices
					"last 2 chrome versions",
					"last 2 safari versions",
					"last 2 edge versions",
					"last 2 firefox versions",
					"firefox esr",
					"maintained node versions",
				],
			}),
		],
	},
];

export default options;
