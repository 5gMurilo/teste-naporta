module.exports = {
	preset: "ts-jest/presets/default-esm",
	testEnvironment: "node",
	testMatch: ["<rootDir>/src/**/*.spec.ts"],
	extensionsToTreatAsEsm: [".ts"],
	transform: {
		"^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "tsconfig.json" }],
	},
	moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};
