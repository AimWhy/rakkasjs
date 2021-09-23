import { Defaults, Options } from "./interfaces";
import { prompt } from "enquirer";
import { render, Text } from "ink";
import React, { FC, useEffect, useState, Fragment } from "react";
import { generate } from "./generate";
import { spawn } from "child_process";
import Spinner from "ink-spinner";

export async function getOptions({
	availablePackageManagers,
	defaults: { packageManager, features },
}: Defaults): Promise<Options> {
	const questions = [
		{
			name: "packageManager",
			message: "Package manager",
			type: "select",
			choices: availablePackageManagers,
			initial: packageManager as any,
		},
		{
			name: "features",
			message: "Optional features (toggle with SPACE, accept with ENTER)",
			type: "multiselect",
			choices: [
				{ message: "Demo app", name: "demo" },
				{ message: "TypeScript", name: "typescript" },
				{ message: "Unit testing with Jest", name: "jest" },
				{ message: "End-to-end API testing with Jest", name: "api" },
				{
					message: "End-to-end browser testing with Cypress",
					name: "cypress",
				},
				{
					message: "JavaScript/TypeScript linting with ESLint",
					name: "eslint",
				},
				{ message: "CSS linting with Stylelint ", name: "stylelint" },
				{ message: "Code formatting with Prettier", name: "prettier" },
			],
			initial: Object.keys(features).filter(
				(k) => features[k as keyof typeof features],
			) as any,
		},
	];

	if (availablePackageManagers.length < 2) questions.splice(0, 1);

	const answers: {
		packageManager?: "npm" | "yarn" | "pnpm";
		features: Array<
			"typescript" | "jest" | "eslint" | "stylelint" | "prettier"
		>;
	} = await prompt(questions);

	const result = {
		packageManager: availablePackageManagers[0],
		...answers,
		features: {
			demo: false,
			typescript: false,
			jest: false,
			api: false,
			cypress: false,
			eslint: false,
			stylelint: false,
			prettier: false,
			...Object.fromEntries(answers.features.map((k) => [k, true])),
		},
	};

	return result;
}

export async function runGenerate(opts: Options, version: string) {
	return new Promise<void>(() => {
		render(<Generator opts={opts} version={version} />);
	});
}

const Generator: FC<{ opts: Options; version: string }> = ({
	opts,
	version,
}) => {
	interface Step {
		title: string;
		output: Array<{
			type: "out" | "err";
			content: string;
		}>;
	}

	const [steps, setSteps] = useState<Step[]>([]);
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		generate(opts, {
			version,

			startStep(step) {
				setSteps((old) => [...old, { title: step, output: [] }]);
			},

			runCommand(command) {
				return new Promise<number>((resolve, reject) => {
					const spawned = spawn(command, {
						stdio: ["inherit", "pipe", "pipe"],
						shell: true,
					});

					spawned.on("error", reject);

					spawned.on("exit", (exitCode) => resolve(exitCode || 0));

					spawned.stdout.setEncoding("utf-8");
					spawned.stdout.on("data", (chunk) => {
						setSteps((old) => {
							const prev = old.slice(0, -1);
							let last = old[old.length - 1];
							const lastOutput = last.output[last.output.length - 1];

							if (lastOutput && lastOutput.type === "out") {
								last = {
									...last,
									output: [
										...last.output.slice(0, -1),
										{
											type: "out",
											content: lastOutput.content + chunk,
										},
									],
								};
							} else {
								last = {
									...last,
									output: [
										...last.output,
										{
											type: "out",
											content: chunk,
										},
									],
								};
							}

							return [...prev, last];
						});
					});

					spawned.stderr.setEncoding("utf-8");
					spawned.stderr.on("data", (chunk) => {
						setSteps((old) => {
							const prev = old.slice(0, -1);
							let last = old[old.length - 1];
							const lastOutput = last.output[last.output.length - 1];

							if (lastOutput && lastOutput.type === "err") {
								last = {
									...last,
									output: [
										...last.output.slice(0, -1),
										{
											type: "err",
											content: lastOutput.content + chunk,
										},
									],
								};
							} else {
								last = {
									...last,
									output: [
										...last.output,
										{
											type: "err",
											content: chunk,
										},
									],
								};
							}

							return [...prev, last];
						});
					});
				});
			},
		})
			.then(() => setDone(true))
			.catch((err) => {
				const message = err instanceof Error ? err.message : "Unknown error";
				setError(message);
			});
	}, []);

	return (
		<>
			{steps.map((step, i) => {
				const isLastStep = i === steps.length - 1;

				return (
					<Fragment key={i}>
						<Text bold={isLastStep && !done}>
							{isLastStep && !done && !error ? (
								<Text color="yellow">
									<Spinner />
								</Text>
							) : isLastStep && error ? (
								<Text color="redBright">✗</Text>
							) : (
								<Text color="green">✓</Text>
							)}{" "}
							{step.title}
						</Text>

						{error &&
							step.output.map(
								(output, i) =>
									output.content && (
										<Text
											key={i}
											color={output.type === "err" ? "redBright" : "white"}
										>
											{output.content}
										</Text>
									),
							)}
					</Fragment>
				);
			})}

			{error && (
				<Text color="redBright">Project generation failed: {error}</Text>
			)}

			{done && (
				<Text color="white">
					{"\n"}
					<Text color="greenBright">Done!</Text> Try following commands to
					start:{"\n"}
					<Text bold>{opts.packageManager} run dev</Text>
					{"   "}
					<Text color="white"># Start a development server</Text>
					{"\n"}
					<Text bold>{opts.packageManager} run build</Text>{" "}
					<Text color="white"># Build for production</Text>
					{"\n"}
					<Text bold>{opts.packageManager} start</Text>
					{"     "}
					<Text color="white"># Run production server</Text>
					{"\n"}
				</Text>
			)}
		</>
	);
};
