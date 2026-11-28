/** Prints the board audit. Exits 1 if any check could not run. */
import process from "node:process";
import { readBoard, readOpenIssues } from "./github.ts";
import { attempt } from "./paginate.ts";
import { report } from "./report.ts";

const board = attempt(readBoard);
const open = attempt(readOpenIssues);
console.log(report(board, open, new Date().toISOString()));
if (!board.ok || !open.ok) process.exitCode = 1;
