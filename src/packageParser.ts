import * as yauzl from 'yauzl';
import * as xml2js from 'xml2js';
import * as path from 'path';
import { NuGetPackageMetadata, PackageContent, PackageFile, PackageDependency, FileContent } from './types';
import { logInfo, logError, logWarning, logDebug } from './extension';

export class NuGetPackageParser {
    
    /**
     * Parse a .nupkg file and extract its metadata and contents
     */
    public static async parsePackage(packagePath: string): Promise<PackageContent> {
        logInfo(`Starting to parse package: ${packagePath}`);
        return new Promise((resolve, reject) => {
            yauzl.open(packagePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    logError(`Failed to open package file: ${packagePath}`, err);
                    reject(err);
                    return;
                }

                if (!zipfile) {
                    const error = new Error('Failed to open package file');
                    logError(`Zipfile is null for package: ${packagePath}`);
                    reject(error);
                    return;
                }

                logInfo(`Package file opened successfully, starting to read entries...`);
                const files: PackageFile[] = [];
                let nuspecContent: string | undefined;
                let iconData: Buffer | undefined;
                let metadata: NuGetPackageMetadata | undefined;
                let readmeContent: string | undefined;
                let readmePath: string | undefined;

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    const fileName = entry.fileName;
                    logDebug(`Processing entry: ${fileName}`);
                    
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
                        logInfo(`Found .nuspec file: ${fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logError(`Failed to read .nuspec file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', async () => {
                                nuspecContent = Buffer.concat(chunks).toString('utf8');
                                logInfo(`Read .nuspec content, length: ${nuspecContent.length} characters`);
                                try {
                                    metadata = await NuGetPackageParser.parseNuspec(nuspecContent);
                                    logInfo(`Successfully parsed .nuspec metadata`);
                                } catch (parseErr) {
                                    logError(`Failed to parse .nuspec`, parseErr instanceof Error ? parseErr : undefined);
                                }
                                zipfile.readEntry();
                            });
                        });
                    } 
                    // Check if this is an icon file
                    else if (NuGetPackageParser.isIconFile(fileName)) {
                        logInfo(`Found icon file: ${fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logError(`Failed to read icon file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                iconData = Buffer.concat(chunks);
                                logInfo(`Icon data loaded, size: ${iconData.length} bytes`);
                                zipfile.readEntry();
                            });
                        });
                    }
                    // Check if this is a readme file
                    else if (NuGetPackageParser.isReadmeFile(fileName)) {
                        logInfo(`Found readme file: ${fileName}`);
                        readmePath = fileName;
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logError(`Failed to read readme file: ${fileName}`, err);
                                zipfile.readEntry();
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                readmeContent = Buffer.concat(chunks).toString('utf8');
                                logInfo(`Readme content loaded, length: ${readmeContent.length} characters`);
                                zipfile.readEntry();
                            });
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => {
                    logInfo(`Finished reading all entries from package. Total files: ${files.length}`);
                    if (!metadata) {
                        const error = new Error('No .nuspec file found or failed to parse metadata');
                        logError('Package parsing failed: No metadata found');
                        reject(error);
                        return;
                    }

                    logInfo('Building file tree structure...');
                    // Build file tree structure
                    const fileTree = NuGetPackageParser.buildFileTree(files);
                    logInfo(`File tree built successfully with ${fileTree.length} top-level entries`);

                    const result: PackageContent = {
                        metadata,
                        files: fileTree,
                        nuspecContent,
                        iconData,
                        readmeContent,
                        readmePath
                    };
                    
                    logInfo(`Package parsing completed successfully for: ${packagePath}`);
                    resolve(result);
                });

                zipfile.on('error', (error) => {
                    logError(`Zipfile error while parsing package: ${packagePath}`, error);
                    reject(error);
                });
            });
        });
    }

    /**
     * Get the content of a specific file from the package
     */
    public static async getFileContent(packagePath: string, filePath: string): Promise<FileContent> {
        logInfo(`Getting file content for: ${filePath} from package: ${packagePath}`);
        return new Promise((resolve, reject) => {
            yauzl.open(packagePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    logError(`Failed to open package for file content: ${packagePath}`, err);
                    reject(err);
                    return;
                }

                if (!zipfile) {
                    const error = new Error('Failed to open package file');
                    logError(`Zipfile is null when getting file content from: ${packagePath}`);
                    reject(error);
                    return;
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (entry.fileName === filePath) {
                        logInfo(`Found target file in package: ${filePath}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                logError(`Failed to open read stream for file: ${filePath}`, err);
                                reject(err);
                                return;
                            }

                            const chunks: Buffer[] = [];
                            readStream!.on('data', (chunk) => chunks.push(chunk));
                            readStream!.on('end', () => {
                                const content = Buffer.concat(chunks);
                                const mimeType = NuGetPackageParser.getMimeType(filePath);
                                logInfo(`File content retrieved successfully: ${filePath}, size: ${content.length} bytes, type: ${mimeType}`);
                                
                                resolve({
                                    path: filePath,
                                    content,
                                    mimeType
                                });
                            });
                        });
                        return;
                    }
                    zipfile.readEntry();
                });

                zipfile.on('end', () => {
                    const error = new Error(`File not found: ${filePath}`);
                    logError(`File not found in package: ${filePath}`);
                    reject(error);
                });

                zipfile.on('error', (error) => {
                    logError(`Zipfile error while getting file content from: ${packagePath}`, error);
                    reject(error);
                });
            });
        });
    }

    private static async parseNuspec(nuspecContent: string): Promise<NuGetPackageMetadata> {
        logInfo('Parsing .nuspec content...');
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

        const parsedMetadata: NuGetPackageMetadata = {
            id: getText(metadata.id) || '',
            version: getText(metadata.version) || '',
            title: getText(metadata.title),
            description: getText(metadata.description),
            authors: getTextArray(metadata.authors),
            owners: getTextArray(metadata.owners),
            licenseUrl: getText(metadata.licenseUrl),
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
            serviceable: getText(metadata.serviceable) === 'true'
        };

        logInfo(`Parsed metadata for package: ${parsedMetadata.id} v${parsedMetadata.version}`);
        return parsedMetadata;
    }

    private static buildFileTree(files: PackageFile[]): PackageFile[] {
        logDebug('Building file tree structure...');
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

        logDebug(`Built file tree with ${tree.length} top-level entries`);
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
