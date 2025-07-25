import * as yauzl from 'yauzl';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { NuGetPackageMetadata, PackageContent, PackageFile, PackageDependency, FileContent, PackageType } from './types';
import { logger } from './extension';

export class NuGetPackageParser {
    
    /**
     * Parse a .nupkg file and extract its metadata and contents
     */
    public static async parsePackage(packagePath: string): Promise<PackageContent> {
        logger.info(`Starting to parse package: ${packagePath}`);
        return new Promise((resolve, reject) => {
            yauzl.open(packagePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    logger.error(`Failed to open package file: ${packagePath}`, err);
                    reject(err);
                    return;
                }

                if (!zipfile) {
                    const error = new Error('Failed to open package file');
                    logger.error(`Zipfile is null for package: ${packagePath}`);
                    reject(error);
                    return;
                }

                logger.info(`Package file opened successfully, starting to read entries...`);
                const files: PackageFile[] = [];
                let nuspecContent: string | undefined;
                let iconData: Buffer | undefined;
                let metadata: NuGetPackageMetadata | undefined;
                let readmeContent: string | undefined;
                let readmePath: string | undefined;
                let licenseContent: string | undefined;
                let licensePath: string | undefined;
                let mcpServerContent: string | undefined;
                let mcpServerPath: string | undefined;

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    const fileName = entry.fileName;
                    logger.trace(`Processing entry: ${fileName}`);
                    
                    // Create file entry
                    const file: PackageFile = {
                        path: fileName,
                        name: path.basename(fileName),
                        size: entry.uncompressedSize,
                        isDirectory: fileName.endsWith('/')
                    };
                    files.push(file);

                    // Check if this is the .nuspec file
                    if (fileName.endsWith('.nuspec')) {
                        logger.info(`Found .nuspec file: ${fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to read .nuspec file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', async () => {
                                nuspecContent = Buffer.concat(chunks).toString('utf8');
                                logger.info(`Read .nuspec content, length: ${nuspecContent.length} characters`);
                                try {
                                    metadata = await NuGetPackageParser.parseNuspec(nuspecContent);
                                    logger.info(`Successfully parsed .nuspec metadata`);
                                } catch (parseErr) {
                                    logger.error(`Failed to parse .nuspec`, parseErr instanceof Error ? parseErr : undefined);
                                }
                                zipfile.readEntry();
                            });
                        });
                    } 
                    // Check if this is an icon file
                    else if (NuGetPackageParser.isIconFile(fileName)) {
                        logger.trace(`Found icon file: ${fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to read icon file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                iconData = Buffer.concat(chunks);
                                logger.info(`Icon data loaded, size: ${iconData.length} bytes`);
                                zipfile.readEntry();
                            });
                        });
                    }
                    // Check if this is a readme file
                    else if (NuGetPackageParser.isReadmeFile(fileName)) {
                        logger.trace(`Found readme file: ${fileName}`);
                        readmePath = fileName;
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to read readme file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                readmeContent = Buffer.concat(chunks).toString('utf8');
                                logger.info(`Readme content loaded, length: ${readmeContent.length} characters`);
                                zipfile.readEntry();
                            });
                        });
                    }
                    // Check if this is a license file
                    else if (NuGetPackageParser.isLicenseFile(fileName)) {
                        logger.info(`Found license file: ${fileName}`);
                        licensePath = fileName;
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to read license file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                licenseContent = Buffer.concat(chunks).toString('utf8');
                                logger.info(`License content loaded, length: ${licenseContent.length} characters`);
                                zipfile.readEntry();
                            });
                        });
                    }
                    // Check if this is an MCP server file
                    else if (NuGetPackageParser.isMcpServerFile(fileName)) {
                        logger.info(`Found MCP server file: ${fileName}`);
                        mcpServerPath = fileName;
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to read MCP server file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                mcpServerContent = Buffer.concat(chunks).toString('utf8');
                                logger.info(`MCP server content loaded, length: ${mcpServerContent.length} characters`);
                                zipfile.readEntry();
                            });
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => {
                    logger.info(`Finished reading all entries from package. Total files: ${files.length}`);
                    if (!metadata) {
                        const error = new Error('No .nuspec file found or failed to parse metadata');
                        logger.error('Package parsing failed: No metadata found');
                        // Close the ZIP file before rejecting
                        zipfile.close();
                        reject(error);
                        return;
                    }

                    logger.trace('Building file tree structure...');
                    // Build file tree structure
                    const fileTree = NuGetPackageParser.buildFileTree(files);
                    logger.trace(`File tree built successfully with ${fileTree.length} top-level entries`);

                    const result: PackageContent = {
                        metadata,
                        files: fileTree,
                        nuspecContent,
                        iconData,
                        readmeContent,
                        readmePath,
                        licenseContent,
                        licensePath,
                        mcpServerContent,
                        mcpServerPath
                    };
                    
                    logger.info(`Package parsing completed successfully for: ${packagePath}`);
                    // Close the ZIP file before resolving
                    zipfile.close();
                    resolve(result);
                });

                zipfile.on('error', (error) => {
                    logger.error(`Zipfile error while parsing package: ${packagePath}`, error);
                    // Close the ZIP file on error
                    zipfile.close();
                    reject(error);
                });
            });
        });
    }

    /**
     * Get the content of a specific file from the package
     */
    public static async getFileContent(packagePath: string, filePath: string): Promise<FileContent> {
        logger.trace(`Getting file content for: ${filePath} from package: ${packagePath}`);
        return new Promise((resolve, reject) => {
            yauzl.open(packagePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    logger.error(`Failed to open package for file content: ${packagePath}`, err);
                    reject(err);
                    return;
                }

                if (!zipfile) {
                    const error = new Error('Failed to open package file');
                    logger.error(`Zipfile is null when getting file content from: ${packagePath}`);
                    reject(error);
                    return;
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (entry.fileName === filePath) {
                        logger.trace(`Found target file in package: ${filePath}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logger.error(`Failed to open read stream for file: ${filePath}`, err);
                                // Close the ZIP file before rejecting
                                zipfile.close();
                                reject(err);
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                const content = Buffer.concat(chunks);
                                const mimeType = NuGetPackageParser.getMimeType(filePath);
                                logger.trace(`File content retrieved successfully: ${filePath}, size: ${content.length} bytes, type: ${mimeType}`);
                                
                                // Close the ZIP file before resolving
                                zipfile.close();
                                resolve({
                                    path: filePath,
                                    content,
                                    mimeType
                                });
                            });
                            
                            readStream!.on('error', (streamErr) => {
                                logger.error(`Error reading stream for file: ${filePath}`, streamErr);
                                zipfile.close();
                                reject(streamErr);
                            });
                        });
                        return;
                    }
                    zipfile.readEntry();
                });

                zipfile.on('end', () => {
                    const error = new Error(`File not found: ${filePath}`);
                    logger.error(`File not found in package: ${filePath}`);
                    // Close the ZIP file before rejecting
                    zipfile.close();
                    reject(error);
                });

                zipfile.on('error', (error) => {
                    logger.error(`Zipfile error while getting file content from: ${packagePath}`, error);
                    // Close the ZIP file on error
                    zipfile.close();
                    reject(error);
                });
            });
        });
    }

    private static async parseNuspec(nuspecContent: string): Promise<NuGetPackageMetadata> {
        logger.trace('Parsing .nuspec content...');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(nuspecContent);
        
        const pkg = result.package;
        const metadata = pkg.metadata[0];

        // Helper function to get text content from XML node
        const getText = (node: any): string | undefined => {
            if (!node || !node[0]) {
                return undefined;
            }
            return typeof node[0] === 'string' ? node[0] : node[0]._;
        };

        // Helper function to get array of text content
        const getTextArray = (node: any): string[] => {
            if (!node || !node[0]) {
                return [];
            }
            const text = getText(node);
            return text ? text.split(',').map(s => s.trim()).filter(s => s) : [];
        };

        // Parse dependencies
        const dependencies: PackageDependency[] = [];
        if (metadata.dependencies && metadata.dependencies[0]) {
            const deps = metadata.dependencies[0];
            if (deps.group) {
                // Framework-specific dependencies
                for (const group of deps.group) {
                    const targetFramework = group.$.targetFramework;
                    if (group.dependency) {
                        for (const dep of group.dependency) {
                            dependencies.push({
                                id: dep.$.id,
                                version: dep.$.version,
                                targetFramework,
                                exclude: dep.$.exclude,
                                include: dep.$.include
                            });
                        }
                    }
                }
            } else if (deps.dependency) {
                // Global dependencies
                for (const dep of deps.dependency) {
                    dependencies.push({
                        id: dep.$.id,
                        version: dep.$.version,
                        exclude: dep.$.exclude,
                        include: dep.$.include
                    });
                }
            }
        }

        // Parse license information
        let license: string | undefined;
        let licenseType: 'expression' | 'file' | undefined;
        if (metadata.license && metadata.license[0]) {
            const licenseNode = metadata.license[0];
            license = getText(metadata.license);
            if (licenseNode.$ && licenseNode.$.type) {
                licenseType = licenseNode.$.type as 'expression' | 'file';
            }
        }

        // Parse package types
        const packageTypes: PackageType[] = [];
        if (metadata.packageTypes && metadata.packageTypes[0] && metadata.packageTypes[0].packageType) {
            for (const packageType of metadata.packageTypes[0].packageType) {
                packageTypes.push({
                    name: packageType.$.name || '',
                    version: packageType.$.version
                });
            }
        }

        const parsedMetadata: NuGetPackageMetadata = {
            id: getText(metadata.id) || '',
            version: getText(metadata.version) || '',
            title: getText(metadata.title),
            description: getText(metadata.description),
            authors: getTextArray(metadata.authors),
            owners: getTextArray(metadata.owners),
            licenseUrl: getText(metadata.licenseUrl),
            license,
            licenseType,
            projectUrl: getText(metadata.projectUrl),
            repositoryUrl: metadata.repository?.[0]?.$.url,
            repositoryType: metadata.repository?.[0]?.$.type,
            iconUrl: getText(metadata.iconUrl),
            tags: getTextArray(metadata.tags),
            releaseNotes: getText(metadata.releaseNotes),
            copyright: getText(metadata.copyright),
            requireLicenseAcceptance: getText(metadata.requireLicenseAcceptance) === 'true',
            dependencies,
            language: getText(metadata.language),
            developmentDependency: getText(metadata.developmentDependency) === 'true',
            serviceable: getText(metadata.serviceable) === 'true',
            packageTypes
        };

        logger.info(`Parsed metadata for package: ${parsedMetadata.id} v${parsedMetadata.version}`);
        return parsedMetadata;
    }

    private static buildFileTree(files: PackageFile[]): PackageFile[] {
        logger.trace('Building file tree structure...');
        const tree: PackageFile[] = [];
        const pathMap = new Map<string, PackageFile>();

        // Sort files by path to ensure proper hierarchy
        files.sort((a, b) => a.path.localeCompare(b.path));

        for (const file of files) {
            const parts = file.path.split('/').filter(p => p);
            
            if (parts.length === 1) {
                // Top-level file
                tree.push(file);
                pathMap.set(file.path, file);
            } else {
                // Nested file - find or create parent directory
                let currentPath = '';
                let currentLevel = tree;
                
                for (let i = 0; i < parts.length - 1; i++) {
                    currentPath += (currentPath ? '/' : '') + parts[i];
                    
                    let existing = pathMap.get(currentPath + '/');
                    if (!existing) {
                        // Create directory entry
                        existing = {
                            path: currentPath + '/',
                            name: parts[i],
                            size: 0,
                            isDirectory: true,
                            children: []
                        };
                        currentLevel.push(existing);
                        pathMap.set(currentPath + '/', existing);
                    }
                    
                    if (!existing.children) {
                        existing.children = [];
                    }
                    currentLevel = existing.children;
                }
                
                // Add the file to its parent directory
                currentLevel.push(file);
                pathMap.set(file.path, file);
            }
        }

        logger.trace(`Built file tree with ${tree.length} top-level entries`);
        return tree;
    }

    private static isIconFile(fileName: string): boolean {
        const iconExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico'];
        const ext = path.extname(fileName).toLowerCase();
        return iconExtensions.includes(ext) && fileName.toLowerCase().includes('icon');
    }

    private static isReadmeFile(fileName: string): boolean {
        const readmeNames = ['readme.md', 'readme.txt', 'readme.rst', 'readme'];
        const baseName = path.basename(fileName).toLowerCase();
        return readmeNames.includes(baseName) || baseName.startsWith('readme.');
    }

    private static isLicenseFile(fileName: string): boolean {
        const licenseNames = ['license', 'license.md', 'license.txt', 'license.rst', 'licence', 'licence.md', 'licence.txt', 'licence.rst', 'copying', 'copying.md', 'copying.txt'];
        const baseName = path.basename(fileName).toLowerCase();
        return licenseNames.includes(baseName) || baseName.startsWith('license.') || baseName.startsWith('licence.');
    }

    private static isMcpServerFile(fileName: string): boolean {
        return fileName.toLowerCase() === '.mcp/server.json';
    }

    private static getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.yml': 'text/yaml',
            '.yaml': 'text/yaml',
            '.cs': 'text/x-csharp',
            '.js': 'text/javascript',
            '.ts': 'text/typescript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }
}
