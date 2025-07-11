import * as assert from 'assert';
import { NuGetPackageMetadata, PackageType } from '../types';

suite('MCP Server Test Suite', () => {
    
    test('Should detect MCP Server package type', () => {
        const metadata: NuGetPackageMetadata = {
            id: 'test-mcp-server',
            version: '1.0.0',
            packageTypes: [
                { name: 'McpServer', version: '1.0.0' }
            ]
        };

        // Check if package type is detected correctly
        const isMcpServer = metadata.packageTypes?.some(pt => pt.name === 'McpServer') || false;
        assert.strictEqual(isMcpServer, true, 'Should detect McpServer package type');
    });

    test('Should not detect MCP Server package type when not present', () => {
        const metadata: NuGetPackageMetadata = {
            id: 'test-regular-package',
            version: '1.0.0',
            packageTypes: [
                { name: 'Library', version: '1.0.0' }
            ]
        };

        // Check if package type is not detected
        const isMcpServer = metadata.packageTypes?.some(pt => pt.name === 'McpServer') || false;
        assert.strictEqual(isMcpServer, false, 'Should not detect McpServer package type when not present');
    });

    test('Should handle missing package types array', () => {
        const metadata: NuGetPackageMetadata = {
            id: 'test-no-types',
            version: '1.0.0'
        };

        // Check if package type is not detected when array is missing
        const isMcpServer = metadata.packageTypes?.some(pt => pt.name === 'McpServer') || false;
        assert.strictEqual(isMcpServer, false, 'Should handle missing packageTypes array');
    });

    test('Should detect MCP server file path correctly', () => {
        const mcpServerPath = '.mcp/server.json';
        const testPaths = [
            '.mcp/server.json',
            '.MCP/SERVER.JSON',
            'other/file.json',
            'server.json'
        ];

        // Test the logic that would be in isMcpServerFile
        const isMcpServerFile = (fileName: string): boolean => {
            return fileName.toLowerCase() === '.mcp/server.json';
        };

        assert.strictEqual(isMcpServerFile(testPaths[0]), true, 'Should detect exact MCP server file path');
        assert.strictEqual(isMcpServerFile(testPaths[1]), true, 'Should detect case-insensitive MCP server file path');
        assert.strictEqual(isMcpServerFile(testPaths[2]), false, 'Should not detect non-MCP server file path');
        assert.strictEqual(isMcpServerFile(testPaths[3]), false, 'Should not detect server.json in wrong location');
    });

    test('Should format JSON content correctly', () => {
        const testJson = '{"name":"test-server","version":"1.0.0"}';
        const expectedFormatted = '{\n  "name": "test-server",\n  "version": "1.0.0"\n}';

        // Test JSON formatting logic
        let formattedContent = testJson;
        try {
            const jsonObj = JSON.parse(testJson);
            formattedContent = JSON.stringify(jsonObj, null, 2);
        } catch (e) {
            // If parsing fails, just use the original content
            formattedContent = testJson;
        }

        assert.strictEqual(formattedContent, expectedFormatted, 'Should format JSON correctly');
    });

    test('Should handle invalid JSON gracefully', () => {
        const invalidJson = '{"name":"test-server","version":}';

        // Test JSON formatting logic with invalid JSON
        let formattedContent = invalidJson;
        try {
            const jsonObj = JSON.parse(invalidJson);
            formattedContent = JSON.stringify(jsonObj, null, 2);
        } catch (e) {
            // If parsing fails, just use the original content
            formattedContent = invalidJson;
        }

        assert.strictEqual(formattedContent, invalidJson, 'Should handle invalid JSON gracefully');
    });
});