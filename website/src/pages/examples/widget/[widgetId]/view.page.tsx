import React from "react";
import { definePage, DefinePageTypesUnder, Link } from "rakkasjs";
import { WidgetLayoutTypes } from "./layout";

type WidgetViewPageTypes = DefinePageTypesUnder<
	WidgetLayoutTypes,
	{
		params: { widgetId: string };
	}
>;

export default definePage<WidgetViewPageTypes>({
	Component: function WidgetViewPage({ context: { widget } }) {
		return (
			<div>
				<h1>View {widget.name}</h1>
				<p>{widget.description}</p>
				<p>
					<Link href="./edit">Edit {widget.name}</Link>
				</p>
			</div>
		);
	},
});
