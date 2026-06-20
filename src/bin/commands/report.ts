import { generateReport, formatReport } from '../../core/report.js';

export function runReport(args: string[]): void {
    const file = args.find(a => !a.startsWith('-'));
    if (!file) {
        console.error('Usage: valentino report <file.css|file.html>');
        process.exit(1);
    }

    const report = generateReport(file);
    console.log(formatReport(report));

    if (!report.passed) process.exit(1);
}
