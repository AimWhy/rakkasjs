export async function get() {
	const data = (await import("./data.json")).default;

	return {
		headers: {
			"content-type": "application/json",
		},
		body: [
			...data.map((x) => ({ slug: x.slug, title: x.title })),
			{
				slug: "not-here",
				title: "Broken link",
			},
		],
	};
}
