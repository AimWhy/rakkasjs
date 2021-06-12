/**
 * Sorts routes by specificity
 */
export function sortRoutes<T>(
	routes: Array<Route<T>>,
): Array<RouteWithRegExp<T>> {
	const segments = routes.map(parseRouteIntoSegments);
	segments.sort(compareRoutes);

	return segments.map((seg) => ({
		...seg.route,
		regexp: seg.regexp,
		paramNames: seg.paramNames,
	}));
}

function compareRoutes(
	a: ParsedRoute<unknown>,
	b: ParsedRoute<unknown>,
): number {
	for (const [i, aseg] of a.segments.entries()) {
		const bseg = b.segments[i];
		if (!bseg) {
			return 1;
		}

		if (aseg.content === bseg.content) continue;

		const patternDiff = Number(aseg.hasPattern) - Number(bseg.hasPattern);
		if (patternDiff) {
			return patternDiff;
		}

		if (aseg.hasPattern) {
			// First one to have a non-placeholder wins
			for (const [j, asub] of aseg.subsegments.entries()) {
				const bsub = (bseg as PlaceholderSegment).subsegments[j];

				if (!bsub) {
					return -1;
				}

				const placeholderDiff =
					Number(asub[0] === "[") - Number(bsub[0] === "[");

				if (placeholderDiff) {
					return placeholderDiff;
				}
			}

			if (
				(bseg as PlaceholderSegment).subsegments.length >
				aseg.subsegments.length
			)
				return 1;
		}

		return aseg.content.localeCompare(bseg.content);
	}

	return a.segments.length - b.segments.length;
}

function parseRouteIntoSegments<T>(route: Route<T>): ParsedRoute<T> {
	if (!route.pattern.startsWith("/"))
		throw new Error(`Invalid route pattern: ${route.pattern}`);

	const segments = route.pattern
		.slice(1)
		.split("/")
		.map((s) => {
			function invalid() {
				throw new Error(`Invalid route pattern "${s}" in ${route.pattern}`);
			}

			if (s.includes("[")) {
				// Split right before "[" and right after "]"
				const subsegments = s.split(/(?=\[)|(?<=\])/).map((sub, i, subs) => {
					if (sub[0] === "[") {
						if (!sub.endsWith("]") || sub.slice(1, -1).match(/\]/)) invalid();
					} else {
						if (sub.endsWith("]")) invalid();

						// Accepted separators are "." and "-" except in the beginning and in the end
						if (
							(i > 0 && !sub.match("^[.-]")) ||
							(i < subs.length - 1 && !sub.match("[.-]$"))
						) {
							invalid();
						}
					}

					return sub;
				});

				return {
					content: s,
					hasPattern: true,
					subsegments,
				} as PlaceholderSegment;
			} else {
				if (s.includes("]")) {
					invalid();
				}

				return {
					content: s,
					hasPattern: false,
				} as SimpleSegment;
			}
		});

	return {
		route,
		segments,
		paramNames: (
			segments.filter((seg) => seg.hasPattern) as PlaceholderSegment[]
		)
			.map((seg) =>
				seg.subsegments
					.filter((sub) => sub[0] === "[")
					.map((sub) => sub.slice(1, -1)),
			)
			.flat(),
		regexp: new RegExp(
			"^\\/" +
				segments
					.map((seg) => {
						if (seg.hasPattern) {
							return seg.subsegments
								.map((sub) => {
									if (sub[0] === "[") {
										return "([^\\/]+)";
									} else {
										return escapeRegExp(sub);
									}
								})
								.join("");
						} else {
							return escapeRegExp(seg.content);
						}
					})
					.join("\\/") +
				"$",
		),
	};
}

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

type RouteSegment = SimpleSegment | PlaceholderSegment;

interface SimpleSegment {
	content: string;
	hasPattern: false;
}

interface PlaceholderSegment {
	content: string;
	hasPattern: true;
	subsegments: string[];
}

interface Route<T> {
	pattern: string;
	extra: T;
}

interface RouteWithRegExp<T> {
	pattern: string;
	extra: T;
	regexp: RegExp;
	paramNames: string[];
}

interface ParsedRoute<T> {
	segments: RouteSegment[];
	route: Route<T>;
	regexp: RegExp;
	paramNames: string[];
}
