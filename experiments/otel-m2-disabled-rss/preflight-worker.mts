import { spawn } from "node:child_process";
import { performanceStage, performanceChild } from "../../packages/gitlode/scripts/tooling/performance-progress.js";
performanceStage({ stage: "execution", operation: "disposable-preflight" });
const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
performanceChild(child.pid);
setInterval(() => {}, 1000);
