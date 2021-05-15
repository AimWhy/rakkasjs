import React, { ComponentType } from "react";
import type { RouteRenderArgs } from "@rakkasjs/core";

import pages from "@rakkasjs:pages";
import layouts from "@rakkasjs:layouts";

const trie: any = {};
pages.forEach(([page, importer]) => {
	let name = page.match(/^(.+)\.page\.[jt]sx?$/)![1];
	if (name.endsWith("index")) {
		name = name.slice(0, -5);
	}
	const segments = name.split("/").filter(Boolean);

	let node = trie;
	for (const segment of segments) {
		if (!node[segment]) {
			node[segment] = {};
		}
		node = node[segment];
	}

	node.$page = importer;
});

layouts.forEach(([layout, importer]) => {
	let name = layout.match(/^(.+)\.layout\.[jt]sx?$/)![1];
	if (name.endsWith("index")) {
		name = name.slice(0, -5);
	}
	const segments = name.split("/").filter(Boolean);

	let node = trie;
	for (const segment of segments) {
		if (!node[segment]) {
			node[segment] = {};
		}
		node = node[segment];
	}

	node.$layout = importer;
});

export async function findAndRenderRoute({
	url: { pathname },
}: RouteRenderArgs) {
	const segments = pathname.split("/").filter(Boolean);

	let node = trie;
	const layoutStack: { default: ComponentType }[] = node.$layout
		? [await node.$layout()]
		: [];
	for (const segment of segments) {
		node = node[segment];
		if (!node) {
			return <p>Page not found</p>;
		}
		if (node.$layout) {
			layoutStack.push(await node.$layout());
		}
	}

	if (!node.$page) {
		return <p>Page not found</p>;
	}

	const page: { default: ComponentType } = await node.$page();

	console.log([...layoutStack, page]);
	return [...layoutStack, page].reduceRight(
		(prev, cur) => React.createElement(cur.default, {}, prev),
		null as React.ReactNode,
	);
}
