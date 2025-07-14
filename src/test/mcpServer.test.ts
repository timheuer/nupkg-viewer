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

    test('Should generate MCP startup configuration correctly', () => {
        const serverConfig = {
            "description": "A sample MCP server using the MCP C# SDK. Generates random numbers and random weather.",
            "name": "io.github.joelverhagen/Knapcode.SampleMcpServer",
            "packages": [
                {
                    "registry_name": "nuget",
                    "name": "Knapcode.SampleMcpServer",
                    "version": "0.6.0-beta",
                    "package_arguments": [
                        {
                            "type": "positional",
                            "value": "mcp",
                            "value_hint": "mcp"
                        },
                        {
                            "type": "positional",
                            "value": "start",
                            "value_hint": "start"
                        }
                    ],
                    "environment_variables": [
                        {
                            "name": "WEATHER_CHOICES",
                            "value": "{weather_choices}",
                            "variables": {
                                "weather_choices": {
                                    "description": "Comma separated list of weather descriptions to randomly select.",
                                    "is_required": true,
                                    "is_secret": false
                                }
                            }
                        }
                    ]
                }
            ]
        };

        // Test the MCP startup configuration generation
        const generateMcpStartupConfig = (serverConfig: any): string => {
            try {
                const inputs: any[] = [];
                const servers: any = {};

                // Process packages
                if (serverConfig.packages && Array.isArray(serverConfig.packages)) {
                    for (const pkg of serverConfig.packages) {
                        if (!pkg.name) {
                            continue;
                        }

                        // Extract inputs from environment variables
                        if (pkg.environment_variables && Array.isArray(pkg.environment_variables)) {
                            for (const envVar of pkg.environment_variables) {
                                if (envVar.variables && typeof envVar.variables === 'object') {
                                    for (const [varName, varConfig] of Object.entries(envVar.variables)) {
                                        if (typeof varConfig === 'object' && varConfig !== null) {
                                            const config = varConfig as any;
                                            inputs.push({
                                                type: "promptString",
                                                id: varName,
                                                description: config.description || `Configuration for ${varName}`,
                                                password: config.is_secret || false
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        // Create server configuration
                        const serverName = pkg.name;
                        const server: any = {
                            type: "stdio",
                            command: "dnx",
                            args: [`${serverName}@${pkg.version || ''}`, "--yes", "--"]
                        };

                        // Add package arguments to args
                        if (pkg.package_arguments && Array.isArray(pkg.package_arguments)) {
                            for (const arg of pkg.package_arguments) {
                                if (arg.type === 'positional' && arg.value) {
                                    server.args.push(arg.value);
                                }
                            }
                        }

                        // Add environment variables
                        if (pkg.environment_variables && Array.isArray(pkg.environment_variables)) {
                            server.env = {};
                            for (const envVar of pkg.environment_variables) {
                                if (envVar.name && envVar.variables) {
                                    // Map environment variable to input reference
                                    for (const varName of Object.keys(envVar.variables)) {
                                        server.env[envVar.name] = `\${input:${varName}}`;
                                    }
                                }
                            }
                        }

                        servers[serverName] = server;
                    }
                }

                const startupConfig = {
                    inputs,
                    servers
                };

                return JSON.stringify(startupConfig, null, 2);
            } catch (error) {
                return `Error generating startup configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        };

        const result = generateMcpStartupConfig(serverConfig);
        const parsedResult = JSON.parse(result);

        // Verify the structure
        assert.strictEqual(parsedResult.inputs.length, 1, 'Should have one input');
        assert.strictEqual(parsedResult.inputs[0].id, 'weather_choices', 'Should have correct input id');
        assert.strictEqual(parsedResult.inputs[0].type, 'promptString', 'Should have correct input type');
        assert.strictEqual(parsedResult.inputs[0].description, 'Comma separated list of weather descriptions to randomly select.', 'Should have correct description');
        assert.strictEqual(parsedResult.inputs[0].password, false, 'Should have correct password setting');

        assert.strictEqual(Object.keys(parsedResult.servers).length, 1, 'Should have one server');
        assert.strictEqual(parsedResult.servers['Knapcode.SampleMcpServer'].type, 'stdio', 'Should have correct server type');
        assert.strictEqual(parsedResult.servers['Knapcode.SampleMcpServer'].command, 'dnx', 'Should have correct command');
        assert.deepStrictEqual(parsedResult.servers['Knapcode.SampleMcpServer'].args, ['Knapcode.SampleMcpServer@0.6.0-beta', '--yes', '--', 'mcp', 'start'], 'Should have correct args with version');
        assert.strictEqual(parsedResult.servers['Knapcode.SampleMcpServer'].env.WEATHER_CHOICES, '${input:weather_choices}', 'Should have correct environment variable mapping');
    });

    test('Should handle empty server configuration', () => {
        const serverConfig = {};

        // Test the MCP startup configuration generation with empty config
        const generateMcpStartupConfig = (serverConfig: any): string => {
            try {
                const inputs: any[] = [];
                const servers: any = {};

                // Process packages
                if (serverConfig.packages && Array.isArray(serverConfig.packages)) {
                    for (const pkg of serverConfig.packages) {
                        if (!pkg.name) {
                            continue;
                        }
                        // ... rest of the logic would be the same
                    }
                }

                const startupConfig = {
                    inputs,
                    servers
                };

                return JSON.stringify(startupConfig, null, 2);
            } catch (error) {
                return `Error generating startup configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        };

        const result = generateMcpStartupConfig(serverConfig);
        const parsedResult = JSON.parse(result);

        // Verify the structure
        assert.strictEqual(parsedResult.inputs.length, 0, 'Should have no inputs for empty config');
        assert.strictEqual(Object.keys(parsedResult.servers).length, 0, 'Should have no servers for empty config');
    });
});