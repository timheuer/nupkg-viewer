// In-memory log buffer for NuGet Package Viewer
class LogMemory {
    private logs: string[] = [];
    private maxLogs: number;
    constructor(maxLogs: number = 75) {
        this.maxLogs = maxLogs;
    }
    add(message: string) {
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }
    getAll(): string {
        return this.logs.join('\n');
    }
    clear() {
        this.logs = [];
    }
}

export const logMemory = new LogMemory(50);
export default LogMemory;
