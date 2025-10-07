import { readFileDirect, writeFileDirect, rmFileDirect } from "@proj/dta-impl";

export const mcpFs = {
  writeFile: writeFileDirect,
  readFile: readFileDirect,
  rmFile: rmFileDirect,
};
