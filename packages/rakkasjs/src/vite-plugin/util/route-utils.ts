export function routeToRegExp(route: string): RegExp {
	// Backslash to slash
	route = route.replace(/\\/g, "/");

	let restParamName: string | undefined;

	const restMatch = route.match(/\/\[\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\]$/);
	if (restMatch) {
		const [rest, restName] = restMatch;
		route = route.slice(0, -rest.length);
		restParamName = restName;
	}

	return new RegExp(
		"^" +
			route
				.split("/")
				.filter((x) => x !== "index" && !x.startsWith("_"))
				.join("/")
				.replace(
					/\[[a-zA-Z_][a-zA-Z0-9_]*]/g,
					(name) => `(?<${name.slice(1, -1)}>[^/]*)`,
				) +
			(restParamName ? `\\/(?<${restParamName}>.*)$` : "\\/?$"),
	);
}

type Route = [pattern: string, ...rest: unknown[]];

export function sortRoutes<R extends Route>(routes: R[]) {
	const processedRoutes = routes
		.map((route) => ({
			original: route,
			isRest: !!route[0].match(/\/\[\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\]$/),
			segments: route[0]
				.split("/")
				.filter((x) => !x.startsWith("_") && x !== "index")
				.map((seg) => ({
					content: seg,
					paramCount: seg.split("[").length - 1,
				})),
		}))
		.sort((a, b) => {
			// Non-rest routes first
			const restDiff = Number(a.isRest) - Number(b.isRest);
			if (restDiff !== 0) {
				return restDiff;
			}

			const aSegments = a.segments;
			const bSegments = b.segments;
			for (let i = 0; i < aSegments.length; i++) {
				const aSegment = aSegments[i];
				const bSegment = bSegments[i];
				const result = compareSegments(aSegment, bSegment);
				if (result !== 0) return result;
			}
			return 0;
		});

	return processedRoutes.map((route) => route.original);
}

interface Segment {
	content: string;
	paramCount: number;
}

function compareSegments(a: Segment, b: Segment) {
	// Lowest number of occurences of "[" wins
	return (
		a.paramCount - b.paramCount ||
		// Alphabetical order
		a.content.localeCompare(b.content)
	);
}
