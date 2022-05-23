import React from "react";
import { Head, StyledLink } from "rakkasjs";

const UserProfilePage = ({ params }) => (
	<div>
		<Head title={`StyledLink Example - Rakkas`} />
		<p>
			Hello <b>{params.userName}</b>!
		</p>
		<nav>
			<ul>
				<li>
					<StyledLink
						href="/examples/navlink/Fatih"
						activeStyle={{ fontWeight: "bold" }}
					>
						Fatih&apos;s profile
					</StyledLink>
				</li>
				<li>
					<StyledLink
						href="/examples/navlink/Dan"
						activeStyle={{ fontWeight: "bold" }}
					>
						Dan&apos;s profile
					</StyledLink>
				</li>
				<li>
					<StyledLink
						href="/examples/navlink/Engin"
						activeStyle={{ fontWeight: "bold" }}
					>
						Engin&apos;s profile
					</StyledLink>
				</li>
			</ul>
		</nav>
	</div>
);

export default UserProfilePage;
