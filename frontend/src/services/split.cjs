const fs = require('fs');
const lines = fs.readFileSync('historyService.ts', 'utf8').split('\n');
const importLine = 'import { AnalysisRecord } from "./historyService";\n';
const mockLines = lines.slice(52, 176);
fs.writeFileSync('mockData.ts', importLine + mockLines.join('\n'));
const newHistory = [...lines.slice(0, 52), 'import { SAMPLE_CXR_1, SAMPLE_CXR_2, SAMPLE_CXR_3, DEFAULT_RECORDS } from "./mockData";', ...lines.slice(176)];
fs.writeFileSync('historyService.ts', newHistory.join('\n'));
