import { readFileDirect, writeFileDirect, rmFileDirect } from "@proj/dta-impl";
export declare const mcpFs: {
    writeFile: typeof writeFileDirect;
    readFile: typeof readFileDirect;
    rmFile: typeof rmFileDirect;
};
