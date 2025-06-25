// Test file to verify logging functionality
// This file can be run manually to test the logging behavior

import { logInfo, logError, logWarning, logDebug, logTrace } from '../extension';

// This function can be called to test all logging levels
export function testLogging(): void {
    console.log('Testing logging functionality...');
    
    logError('This is an error message');
    logWarning('This is a warning message');
    logInfo('This is an info message');
    logDebug('This is a debug message');
    logTrace('This is a trace message');
    
    console.log('Logging test completed. Check the NuGet Package Viewer output channel to see which messages appear based on your log level setting.');
}

// Test the log level filtering by setting different log levels
export function testLogLevelFiltering(): void {
    console.log('Testing log level filtering...');
    console.log('Messages will appear in the output channel based on your nupkg-viewer.logLevel setting:');
    console.log('- off: No messages (logging disabled)');
    console.log('- error: Only error messages');
    console.log('- warn: Warning and error messages');
    console.log('- info: Info, warning, and error messages (default)');
    console.log('- verbose: All messages including debug');
    console.log('- trace: All messages including trace (most verbose)');
    
    testLogging();
}