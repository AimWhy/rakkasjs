import { Head, PageProps, StyledLink, useServerSideQuery } from "rakkasjs";
import css from "../use-query/[pokemon].module.css";
import db from "./db";

// Types for the dynamic route params
interface Params {
	pokemon: string;
}

export default function PokemonStatsPage(props: PageProps<Params>) {
	const {
		params: { pokemon },
	} = props;

	const query = useServerSideQuery(() => {
		// This function's body runs on the server!
		if (typeof pokemon !== "string") {
			// This is server-side code, we should validate
			// every input parameter.
			throw new Error("Invalid request");
		}

		return db.pokemon.findOne(pokemon);
	});

	return (
		<div className={css.wrapper}>
			<div className={css.title}>
				<nav>
					<ul className={css.links}>
						<StyledLink href="/use-ssq/pikachu" activeClass={css.activeLink}>
							Pikachu
						</StyledLink>
						<StyledLink href="/use-ssq/charizard" activeClass={css.activeLink}>
							Charizard
						</StyledLink>
						<StyledLink href="/use-ssq/onix" activeClass={css.activeLink}>
							Onix
						</StyledLink>
					</ul>
				</nav>

				<p>
					<img
						src={query.data.sprites && query.data.sprites.front_default}
						className={css.image}
						height={96}
					/>
				</p>
			</div>

			<h3 className={css.heading}>Stats</h3>
			<ul className={css.stats}>
				{query.data.stats.map((s) => (
					<li className={css.stat} key={s.stat.name}>
						<h4>{s.stat.name}</h4>
						Base: {s.base_stat}
						<br />
						Effort: {s.effort}
					</li>
				))}
			</ul>
		</div>
	);
}
