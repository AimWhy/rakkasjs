import chalk from "chalk";
import { Command } from "commander";
import open from "open";
import { loadConfig } from "../lib/config";
import { installNodeFetch } from "../lib/install-node-fetch";
import { createServers } from "../lib/servers";

export default function devCommand() {
	return new Command("dev")
		.option(
			"-p, --port <port>",
			"development server port number",
			process.env.PORT || "3000",
		)
		.option(
			"-H, --host <host>",
			"development server host",
			process.env.HOST || "localhost",
		)
		.option("-o, --open", "open in browser")
		.description("Start a development server")
		.action(startServer);
}

async function startServer(opts: { port: string; host: string; open?: true }) {
	installNodeFetch();

	const port = Number(opts.port);
	if (!Number.isInteger(port)) {
		throw new Error(`Invalid port number ${opts.port}`);
	}

	const host = opts.host;

	let { config, deps } = await loadConfig();

	async function reload() {
		({ config, deps } = await loadConfig());

		http.on("close", async () => {
			await vite.ws.close();
			await vite.close();

			const newServers = await createServers({
				config,
				deps,
				onReload: reload,
			});

			vite = newServers.vite;
			http = newServers.http;
			http.listen(3000).on("listening", () => {
				// eslint-disable-next-line no-console
				console.log(chalk.whiteBright("Server restarted"));
			});
		});

		http.close();
	}

	let { vite, http } = await createServers({
		config,
		deps,
		onReload: reload,
	});

	http.listen({ port, host }).on("listening", async () => {
		// eslint-disable-next-line no-console
		console.log(
			chalk.green("Server listening on"),
			chalk.whiteBright(`http://${host}:${port}`),
		);

		if (opts.open) {
			// eslint-disable-next-line no-console
			console.log(chalk.blue("Launching the browser"));
			await open(`http://${host}:${port}`);
		}
	});
}
