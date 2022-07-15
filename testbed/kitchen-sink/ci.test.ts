/* eslint-disable import/no-named-as-default-member */
/// <reference types="vite/client" />

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import fetch from "node-fetch";
import path from "path";
import psTree from "ps-tree";
import puppeteer, { ElementHandle } from "puppeteer";
import fs from "fs";
import { promisify } from "util";
import { kill } from "process";
import { load } from "cheerio";

const TEST_HOST = import.meta.env.TEST_HOST || "http://127.0.0.1:3000";

if (import.meta.env.TEST_HOST) {
	testCase("Running on existing server", process.env.NODE_ENV !== "production");
} else {
	if ((process.env.INCLUDE_TESTS ?? "all") === "all") {
		process.env.INCLUDE_TESTS = "dev,prod,miniflare,netlify,netlify-edge,deno";
	}

	const include = process.env.INCLUDE_TESTS!.split(",").filter(Boolean);

	if (include.includes("dev")) {
		testCase("Development Mode", true, "pnpm dev");
	}

	if (include.includes("prod")) {
		testCase("Production Mode", false, "pnpm build && pnpm start");
	}

	const nodeVersions = process.versions.node.split(".");
	const nodeVersionMajor = +nodeVersions[0];
	const nodeVersionMinor = +nodeVersions[1];

	if (include.includes("miniflare")) {
		if (
			nodeVersionMajor >= 17 ||
			(nodeVersionMajor >= 16 && nodeVersionMinor >= 7)
		) {
			testCase(
				"Miniflare",
				false,
				"miniflare -m dist/server/cloudflare-workers-bundle.js -p 3000",
			);
		} else {
			console.warn("Skipping Miniflare test because of Node version");
		}
	}

	if (include.includes("netlify")) {
		testCase(
			"Netlify functions",
			false,
			"pnpm build:netlify && netlify dev -d netlify/static -op 3000",
		);
	}

	if (include.includes("netlify-edge")) {
		testCase(
			"Netlify edge",
			false,
			"pnpm build:netlify-edge && netlify dev -d netlify/static -op 3000",
		);
	}

	if (include.includes("deno")) {
		testCase(
			"Deno",
			false,
			"pnpm build:deno && deno run --allow-read --allow-net --allow-env dist/deno/mod.js",
		);
	}
}

const browser = await puppeteer.launch({
	// headless: false,
	defaultViewport: { width: 1200, height: 800 },
});

const pages = await browser.pages();
const page = pages[0];

function testCase(title: string, dev: boolean, command?: string) {
	describe(title, () => {
		if (command) {
			let cp: ChildProcess | undefined;

			beforeAll(async () => {
				cp = spawn(command, {
					shell: true,
					stdio: "inherit",
					cwd: path.resolve(__dirname),
					env: {
						...process.env,
						BROWSER: "none",
					},
				});

				await new Promise<void>((resolve, reject) => {
					cp!.on("error", (error) => {
						cp = undefined;
						reject(error);
					});

					cp!.on("exit", (code) => {
						if (code !== 0) {
							cp = undefined;
							reject(new Error(`Process exited with code ${code}`));
						}
					});

					const interval = setInterval(() => {
						fetch(TEST_HOST + "/")
							.then(async (r) => {
								const text = await r.text();
								if (
									r.status === 200 &&
									text.includes("This is a shared header.") &&
									text.includes("Hello world!")
								) {
									clearInterval(interval);
									resolve();
								}
							})
							.catch(() => {
								// Ignore error
							});
					}, 250);
				});
			}, 60_000);

			afterAll(async () => {
				if (!cp || cp.exitCode || !cp.pid) {
					return;
				}

				const tree = await promisify(psTree)(cp.pid);
				const pids = [cp.pid, ...tree.map((p) => +p.PID)];

				for (const pid of pids) {
					kill(+pid, "SIGINT");
				}

				await new Promise((resolve) => {
					cp!.on("exit", resolve);
				});
			});
		}

		test("renders simple API route", async () => {
			const response = await fetch(TEST_HOST + "/api-routes/simple");
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toEqual("Hello from API route");
		});

		test("runs middleware", async () => {
			const response = await fetch(TEST_HOST + "/api-routes/simple?abort=1");
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toEqual("Hello from middleware");

			const response2 = await fetch(TEST_HOST + "/api-routes/simple?modify=1");
			expect(response2.status).toBe(200);
			const text2 = await response2.text();
			expect(text2).toEqual("Hello from API route");
			expect(response2.headers.get("x-middleware")).toEqual("1");
		});

		test("renders params", async () => {
			const response = await fetch(TEST_HOST + "/api-routes/param-value");
			expect(response.status).toBe(200);
			const json = await response.json();
			expect(json).toMatchObject({ param: "param-value" });
		});

		test("renders spread params", async () => {
			const response = await fetch(TEST_HOST + "/api-routes/more/aaa/bbb/ccc");
			expect(response.status).toBe(200);
			const json = await response.json();
			expect(json).toMatchObject({ rest: "/aaa/bbb/ccc" });
		});

		test("renders preloaded data", async () => {
			const response = await fetch(TEST_HOST + "/");
			expect(response.status).toBe(200);

			const html = await response.text();
			const dom = load(html);

			expect(dom("p#metadata").text()).toBe("Metadata: 2");
			expect(dom("title").text()).toBe("The page title");
		});

		test("renders interactive page", async () => {
			await page.goto(TEST_HOST + "/");
			await page.waitForSelector(".hydrated");

			const button: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(button).toBeTruthy();

			await button!.click();

			await page.waitForFunction(
				() => document.querySelector("button")?.textContent === "Clicked: 1",
			);
		});

		if (dev) {
			test("hot reloads page", async () => {
				await page.goto(TEST_HOST + "/");
				await page.waitForSelector(".hydrated");

				const button: ElementHandle<HTMLButtonElement> | null =
					await page.waitForSelector("button");

				await button!.click();

				await page.waitForFunction(
					() => document.querySelector("button")?.textContent === "Clicked: 1",
				);

				const filePath = path.resolve(__dirname, "src/routes/index.page.tsx");
				const oldContent = await fs.promises.readFile(filePath, "utf8");
				const newContent = oldContent.replace("Hello world!", "Hot reloadin'!");

				if (process.platform === "win32") {
					await new Promise((resolve) => setTimeout(resolve, 500));
				}

				await fs.promises.writeFile(filePath, newContent);

				try {
					await page.waitForFunction(
						() => document.body?.textContent?.includes("Hot reloadin'!"),
						{ timeout: 60_000 },
					);
					await page.waitForFunction(
						() =>
							document.querySelector("button")?.textContent === "Clicked: 1",
					);
				} finally {
					await fs.promises.writeFile(filePath, oldContent);
				}
			}, 60_000);
		}

		test("sets page title", async () => {
			await page.goto(TEST_HOST + "/title");

			await page.waitForFunction(() => document.title === "Page title");
		});

		test("performs client-side navigation", async () => {
			await page.goto(TEST_HOST + "/nav");
			await page.waitForSelector(".hydrated");

			const button: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(button).toBeTruthy();

			await button!.click();
			await page.waitForFunction(
				() => document.querySelector("button")?.textContent === "State test: 1",
			);

			const link = (await page.waitForSelector(
				"a[href='/nav/a']",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			link!.click();
			await page.waitForFunction(
				(host: string) =>
					document.body?.innerText.includes(`Navigating to: ${host}/nav/a`),
				{},
				TEST_HOST,
			);

			await page.waitForFunction(() => {
				return (window as any).RESOLVE_QUERY !== undefined;
			});

			await page.evaluate(() => {
				(window as any).RESOLVE_QUERY();
			});

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Client-side navigation test page A"),
			);

			await page.waitForFunction(() =>
				document.body?.innerText.includes("State test: 1"),
			);
		});

		test("restores scroll position", async () => {
			await page.goto(TEST_HOST + "/nav?scroll=1");
			await page.waitForSelector(".hydrated");

			// Scroll to the bottom
			await page.evaluate(() =>
				document.querySelector("footer")?.scrollIntoView(),
			);
			await page.waitForFunction(() => window.scrollY > 0);

			const link = (await page.waitForSelector(
				"a[href='/nav/b']",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			link!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Client-side navigation test page B"),
			);

			// Make sure it scrolled to the top
			const scrollPos = await page.evaluate(() => window.scrollY);
			expect(scrollPos).toBe(0);

			// Go back to the first page
			await page.goBack();
			await page.waitForFunction(() =>
				document.body?.innerText.includes(
					"Client-side navigation test page home",
				),
			);

			// Make sure it scrolls to the bottom
			await page.waitForFunction(() => window.scrollY > 0);
		});

		test("handles relative links correctly during transitions", async () => {
			await page.goto(TEST_HOST + "/nav");
			await page.waitForSelector(".hydrated");

			const link = (await page.waitForSelector(
				"a[href='/nav/a']",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			link!.click();
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Navigating to"),
			);

			const x = await page.evaluate(
				() =>
					(document.getElementById("relative-link") as HTMLAnchorElement).href,
			);
			expect(x).toBe(TEST_HOST + "/relative");
		});

		test("redirects", async () => {
			await page.goto(TEST_HOST + "/redirect/shallow");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Redirected"),
			);

			await page.goto(TEST_HOST + "/redirect/deep");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Redirected"),
			);
		});

		test("sets redirect status", async () => {
			let response = await fetch(TEST_HOST + "/redirect/shallow", {
				headers: { "User-Agent": "rakkasjs-crawler" },
				redirect: "manual",
			});
			expect(response.status).toBe(302);

			response = await fetch(TEST_HOST + "/redirect/deep", {
				headers: { "User-Agent": "rakkasjs-crawler" },
				redirect: "manual",
			});
			expect(response.status).toBe(302);
		});

		test("sets status and headers", async () => {
			const response = await fetch(TEST_HOST + "/response-headers", {
				headers: { "User-Agent": "rakkasjs-crawler" },
			});
			expect(response.status).toBe(400);
			expect(response.headers.get("X-Custom-Header")).toBe("Custom value");
		});

		test("fetches data with useQuery", async () => {
			await page.goto(TEST_HOST + "/use-query");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("SSR value"),
			);

			const button = await page.waitForSelector("button");
			expect(button).toBeTruthy();

			await button!.click();
			await page.waitForFunction(() =>
				document
					.getElementById("content")
					?.innerText.includes("SSR value (refetching)"),
			);

			await button!.click();
			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("Client value"),
			);
		});

		test("handles errors in useQuery", async () => {
			await page.goto(TEST_HOST + "/use-query/error");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("Error!"),
			);

			let button = await page.waitForSelector("button");
			expect(button).toBeTruthy();
			await button!.click();
			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("Loading..."),
			);

			button = await page.waitForSelector("button");
			expect(button).toBeTruthy();

			await button!.click();

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("Hello world"),
			);
		});

		test("useQuery refetches on focus", async () => {
			await page.goto(TEST_HOST + "/use-query");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("SSR value"),
			);

			await new Promise((resolve) => setTimeout(resolve, 200));

			await page.evaluate(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			await page.waitForFunction(() =>
				document
					.getElementById("content")
					?.innerText.includes("SSR value (refetching)"),
			);
		});

		test("useQuery refetches on interval", async () => {
			await page.goto(TEST_HOST + "/use-query/interval");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("2"),
			);
		});

		test("queryClient.setQueryData works", async () => {
			await page.goto(TEST_HOST + "/use-query/set-query-data");

			await page.waitForFunction(
				() =>
					document.body?.innerText.includes("AAA") &&
					document.body?.innerText.includes("BBB") &&
					document.body?.innerText.includes("CCC"),
			);
		});

		test("runs useServerSideQuery on the server", async () => {
			await page.goto(TEST_HOST + "/use-ssq");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Result: 7, SSR: true"),
			);

			await page.goto(TEST_HOST + "/use-ssq/elsewhere");
			await page.waitForSelector(".hydrated");

			const link = (await page.waitForSelector(
				"a",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Result: 7, SSR: true"),
			);
		});

		test("runs runServerSideQuery on the server", async () => {
			await page.goto(TEST_HOST + "/run-ssq");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Result: 7, SSR: true"),
			);

			await page.goto(TEST_HOST + "/run-ssq/elsewhere");
			await page.waitForSelector(".hydrated");

			const link = (await page.waitForSelector(
				"a",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Result: 7, SSR: true"),
			);
		});

		test("runs runServerSideMutation on the server", async () => {
			await page.goto(TEST_HOST + "/run-ssm");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Not fetched"),
			);

			const btn: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(btn).toBeTruthy();

			await btn!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Computed on the server: 7"),
			);
		});

		test("runs useServerSideMutation on the server", async () => {
			await page.goto(TEST_HOST + "/use-ssm");
			await page.waitForSelector(".hydrated");

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Not fetched"),
			);

			const btn: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(btn).toBeTruthy();

			await btn!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Computed on the server: 14"),
			);
		});

		test("handles 404", async () => {
			const response = await fetch(TEST_HOST + "/not-found");
			expect(response.status).toBe(404);
			const body = await response.text();
			expect(body).to.contain("Not Found");
		});

		test("handles 404 with layout", async () => {
			const response = await fetch(TEST_HOST + "/404/deep");
			expect(response.status).toBe(404);
			const body = await response.text();
			expect(body).to.contain("This is a shared header.");
			expect(body).to.contain("Deep 404");
		});

		test("handles 404 with client-side nav", async () => {
			await page.goto(TEST_HOST + "/404/deep/found");
			await page.waitForSelector(".hydrated");
			const link = (await page.waitForSelector(
				"a",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Deep 404"),
			);
		});

		test("handles error", async () => {
			const response = await fetch(TEST_HOST + "/error", {
				headers: { "User-Agent": "rakkasjs-crawler" },
			});
			expect(response.status).toBe(500);
		});

		test("handles error with message", async () => {
			await page.goto(TEST_HOST + "/error");

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Internal Error"),
			);
		});

		test("handles error with client-side nav", async () => {
			await page.goto(TEST_HOST + "/error/intro");
			await page.waitForSelector(".hydrated");
			const link = (await page.waitForSelector(
				"a",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Internal Error"),
			);
		});

		test("mutates with useMutation", async () => {
			await page.goto(TEST_HOST + "/use-mutation");
			await page.waitForSelector(".hydrated");

			const btn: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(btn).toBeTruthy();

			await btn!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Loading"),
			);

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Done"),
			);
		});

		test("handles useMutation error", async () => {
			await page.goto(TEST_HOST + "/use-mutation?error");
			await page.waitForSelector(".hydrated");

			const btn: ElementHandle<HTMLButtonElement> | null =
				await page.waitForSelector("button");
			expect(btn).toBeTruthy();

			await btn!.click();

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Loading"),
			);

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Error"),
			);
		});

		test("route guards work", async () => {
			await page.goto(TEST_HOST + "/guard");

			await page.waitForFunction(() =>
				document.body?.innerText.includes("Not Found"),
			);

			await page.goto(TEST_HOST + "/guard?allow-outer");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Not Found"),
			);

			await page.goto(TEST_HOST + "/guard?allow-inner");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Not Found"),
			);

			await page.goto(TEST_HOST + "/guard?allow-outer&allow-inner");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Found!"),
			);

			await page.goto(TEST_HOST + "/guard?allow-outer&rewrite");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Rewritten!"),
			);
		});

		test("beforeRoute redirect works on the server", async () => {
			const r = await fetch(TEST_HOST + "/before-route/redirect", {
				redirect: "manual",
			});
			expect(r.status).toBe(302);
			expect(r.headers.get("location")).toBe(
				TEST_HOST + "/before-route/redirected",
			);
		});

		test("beforeRoute redirect works on the client", async () => {
			await page.goto(TEST_HOST + "/before-route/redirect");
			await page.waitForSelector(".hydrated");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Redirected"),
			);
		});

		test("beforeRoute redirect works with client-side navigation", async () => {
			await page.goto(TEST_HOST + "/before-route/links");
			await page.waitForSelector(".hydrated");

			const link = (await page.waitForSelector(
				"a[href='/before-route/redirect']",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Redirected"),
			);
		});

		test("beforeRoute rewrite works on the server", async () => {
			const r = await fetch(TEST_HOST + "/before-route/rewrite");
			const text = await r.text();
			expect(text).toContain("Rewritten");
		});

		test("beforeRoute rewrite works on the client", async () => {
			await page.goto(TEST_HOST + "/before-route/rewrite");
			await page.waitForSelector(".hydrated");
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Rewritten"),
			);
		});

		test("beforeRoute rewrite works with client-side navigation", async () => {
			await page.goto(TEST_HOST + "/before-route/links");
			await page.waitForSelector(".hydrated");

			const link = (await page.waitForSelector(
				"a[href='/before-route/rewrite']",
			)) as ElementHandle<HTMLAnchorElement> | null;
			expect(link).toBeTruthy();

			await link!.click();
			await page.waitForFunction(() =>
				document.body?.innerText.includes("Rewritten"),
			);
		});

		test("headers function works", async () => {
			const r = await fetch(TEST_HOST + "/headers");
			expect(r.status).toBe(400);
			expect(r.headers.get("X-Test-1")).toBe("1234");
			expect(r.headers.get("X-Test-2")).toBe("GET");
		});

		if (!dev) {
			describe("Static prerendering", () => {
				test.each([
					{ url: "/prerender/bar", shouldPrerender: false },
					{ url: "/prerender/bar-crawled", shouldPrerender: true },
					{ url: "/prerender/foo", shouldPrerender: true },
					{ url: "/prerender/foo-crawled", shouldPrerender: true },
					{ url: "/prerender/not-crawled", shouldPrerender: false },
					{ url: "/prerender/not-prerendered", shouldPrerender: false },
				])("$url", async ({ url, shouldPrerender }) => {
					const response = await fetch(TEST_HOST + url);
					expect(response.status).toBe(200);
					const text = await response.text();

					if (shouldPrerender) {
						expect(text).toContain("This page was prerendered.");
					} else {
						expect(text).toContain("This page was dynamically rendered.");
					}
				});
			});
		}
	});
}

afterAll(async () => {
	await browser.close();
});
