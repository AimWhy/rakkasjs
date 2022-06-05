/* eslint-disable import/no-named-as-default-member */
/// <reference types="vite/client" />

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import fetch from "node-fetch";
import path from "path";
// @ts-expect-error: kill-port doesn't ship with types
import kill from "kill-port";
import puppeteer, { ElementHandle } from "puppeteer";
import fs from "fs";

const TEST_HOST = import.meta.env.TEST_HOST || "http://localhost:3000";

if (import.meta.env.TEST_HOST) {
	testCase("running server", process.env.NODE_ENV !== "production");
} else {
	testCase("development mode", true, "pnpm dev");
	testCase("production mode", false, "pnpm build && pnpm start");
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
			beforeAll(async () => {
				await kill(3000, "tcp").catch(() => {
					// Do nothing
				});

				spawn(command, {
					shell: true,
					stdio: "inherit",
					cwd: path.resolve(__dirname),
				});

				await new Promise<void>((resolve) => {
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
						() => document.body.textContent?.includes("Hot reloadin'!"),
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

			const link: ElementHandle<HTMLAnchorElement> | null =
				await page.waitForSelector("a[href='/nav/a']");
			expect(link).toBeTruthy();

			link!.click();
			await page.waitForFunction(() =>
				document.body.innerText.includes(
					"Navigating to: http://localhost:3000/nav/a",
				),
			);

			await page.waitForFunction(() => {
				return (window as any).RESOLVE_QUERY !== undefined;
			});

			await page.evaluate(() => {
				(window as any).RESOLVE_QUERY();
			});

			await page.waitForFunction(() =>
				document.body.innerText.includes("Client-side navigation test page A"),
			);

			await page.waitForFunction(() =>
				document.body.innerText.includes("State test: 1"),
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

			const link: ElementHandle<HTMLAnchorElement> | null =
				await page.waitForSelector("a[href='/nav/b']");
			expect(link).toBeTruthy();

			link!.click();

			await page.waitForFunction(() =>
				document.body.innerText.includes("Client-side navigation test page B"),
			);

			// Make sure it scrolled to the top
			const scrollPos = await page.evaluate(() => window.scrollY);
			expect(scrollPos).toBe(0);

			// Go back to the first page
			await page.goBack();
			await page.waitForFunction(() =>
				document.body.innerText.includes(
					"Client-side navigation test page home",
				),
			);

			// Make sure it scrolls to the bottom
			await page.waitForFunction(() => window.scrollY > 0);
		});

		test("handles relative links correctly during transitions", async () => {
			await page.goto(TEST_HOST + "/nav");
			await page.waitForSelector(".hydrated");

			const link: ElementHandle<HTMLAnchorElement> | null =
				await page.waitForSelector("a[href='/nav/a']");
			expect(link).toBeTruthy();

			link!.click();
			await page.waitForFunction(() =>
				document.body.innerText.includes("Navigating to"),
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
				document.body.innerText.includes("Redirected"),
			);

			await page.goto(TEST_HOST + "/redirect/deep");
			await page.waitForFunction(() =>
				document.body.innerText.includes("Redirected"),
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

			await page.waitForFunction(() =>
				document.getElementById("content")?.innerText.includes("2"),
			);
		});

		test("runs useServerSideQuery on the server", async () => {
			await page.goto(TEST_HOST + "/use-ssq");
			await page.waitForFunction(() =>
				document.body.innerText.includes("Result: 7, SSR: true"),
			);

			await page.goto(TEST_HOST + "/use-ssq/elsewhere");
			await page.waitForSelector(".hydrated");

			const link: ElementHandle<HTMLAnchorElement> | null =
				await page.waitForSelector("a");
			expect(link).toBeTruthy();

			await link!.click();

			await page.waitForFunction(() =>
				document.body.innerText.includes("Result: 7, SSR: true"),
			);
		});
	});
}

afterAll(async () => {
	await browser.close();

	if (!import.meta.env.TEST_HOST) {
		await kill(3000, "tcp").catch(() => {
			// Do nothing
		});
	}
});
