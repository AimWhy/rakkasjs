import { Command } from "commander";
import { build } from "vite";
import { loadConfig } from "../lib/config";
import { makeViteConfig } from "../lib/vite-config";
import cheerio from "cheerio";
import fs from "fs";
import path from "path";
import micromatch from "micromatch";

export default function buildCommand() {
	return new Command("build")
		.description("Build for production")
		.action(async () => {
			const { config, deps } = await loadConfig();

			await build({
				...makeViteConfig(config, deps),

				build: {
					outDir: "../dist/client",
					emptyOutDir: true,
					ssrManifest: true,
				},
			});

			// Fix index.html
			const template = await fs.promises.readFile(
				path.resolve("./dist/client", "index.html"),
			);

			const dom = cheerio.load(template);

			const html = dom("html").first();
			Object.keys(html.attr()).forEach((a) => html.removeAttr(a));
			html.prepend("<!-- rakkas-html-attributes-placeholder -->");

			const body = html.find("body").first();
			Object.keys(body.attr()).forEach((a) => body.removeAttr(a));
			body.prepend("<!-- rakkas-body-attributes-placeholder -->");

			fs.promises.writeFile(
				path.resolve("./dist", "index.html"),
				dom.html(),
				"utf8",
			);
			fs.promises.unlink(path.resolve("./dist/client", "index.html"));

			// Fix manifest
			const rawManifest = JSON.parse(
				await fs.promises.readFile(
					path.resolve("./dist/client", "ssr-manifest.json"),
					"utf-8",
				),
			);

			const pagesDir = path.resolve("./src/pages");

			const pageMatcher = micromatch.matcher("**/(*.)?page.[[:alnum:]]+");
			const layoutMatcher = micromatch.matcher("**/(*/)?layout.[[:alnum:]]+");
			const manifest = Object.fromEntries(
				Object.entries(rawManifest)
					.map(([name, value]) => {
						const relative = path.relative(pagesDir, name);
						if (
							relative &&
							!relative.startsWith("..") &&
							!path.isAbsolute(relative) &&
							(pageMatcher(relative) || layoutMatcher(relative))
						) {
							return [path.join("/pages", relative), value];
						}
					})
					.filter(Boolean) as Array<[string, string[]]>,
			);

			fs.promises.writeFile(
				path.resolve("./dist", "rakkas-manifest.json"),
				JSON.stringify(manifest),
				"utf8",
			);
			fs.promises.unlink(path.resolve("./dist/client", "ssr-manifest.json"));

			// Build server
			await build({
				...makeViteConfig(config, deps),

				build: {
					ssr: true,
					outDir: "../dist/server",
					rollupOptions: {
						input: ["rakkasjs/server"],
					},
					emptyOutDir: true,
				},

				publicDir: false,
			});
		});
}