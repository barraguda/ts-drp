import { SetDRP } from "@ts-drp/blueprints";
import fs from "fs";
import * as pprof from "pprof";

import { DRPObject, ObjectACL } from "../src/index.js";

const acl = new ObjectACL({
	admins: ["peer1"],
});

type DRPManipulationStrategy = (drp: SetDRP<number>, value: number) => void;

const createWithStrategy = (
	peerId: number,
	verticesPerDRP: number,
	strategy: DRPManipulationStrategy
): DRPObject => {
	const obj = new DRPObject({
		peerId: `peer1_${peerId}`,
		acl,
		drp: new SetDRP<number>(),
	});

	const drp = obj.drp as SetDRP<number>;

	Array.from({ length: verticesPerDRP }).forEach((_, vertex) => {
		strategy(drp, vertex);
	});

	return obj;
};
const manipulationStrategies: DRPManipulationStrategy[] = [
	(drp, value): void => drp.add(value),
	(drp, value): void => {
		drp.delete(value);
		drp.add(value);
	},
	(drp, value): void => {
		drp.add(value);
		drp.delete(value);
	},
];

function createDRPObjects(numDRPs: number, verticesPerDRP: number): DRPObject[] {
	return Array.from({ length: numDRPs }, (_, peerId) =>
		createWithStrategy(peerId, verticesPerDRP, manipulationStrategies[peerId % 3])
	);
}

async function mergeObjects(objects: DRPObject[]): Promise<void> {
	for (const [sourceIndex, sourceObject] of objects.entries()) {
		for (const [targetIndex, targetObject] of objects.entries()) {
			if (sourceIndex !== targetIndex) {
				await sourceObject.merge(targetObject.hashGraph.getAllVertices());
			}
		}
	}
}

async function flamegraphForSetDRP(
	numDRPs: number,
	verticesPerDRP: number,
	mergeFn: boolean
): Promise<void> {
	const objects = createDRPObjects(numDRPs, verticesPerDRP);

	if (mergeFn) {
		await mergeObjects(objects);
	}
}

async function pprofTime(): Promise<void> {
	console.log("start to profile >>>");
	const profile = await pprof.time.profile({
		durationMillis: 1000,
	});

	const buf = await pprof.encode(profile);
	fs.writeFile("flamegraph.pprof", buf, (err) => {
		if (err) {
			throw err;
		}
	});

	console.log("<<< finished to profile");
}

pprofTime().catch(console.error);

await flamegraphForSetDRP(1, 1000, false);
