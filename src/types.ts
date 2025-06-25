/**
 * Types and interfaces for the NuGet Package Viewer extension
 */

export interface NuGetPackageMetadata {
    id: string;
    version: string;
    title?: string;
    description?: string;
    authors?: string[];
    owners?: string[];
    licenseUrl?: string;
    license?: string;
    licenseType?: 'expression' | 'file';
    projectUrl?: string;
    repositoryUrl?: string;
    repositoryType?: string;
    iconUrl?: string;
    icon?: string;
    tags?: string[];
    dependencies?: PackageDependency[];
    releaseNotes?: string;
    copyright?: string;
    language?: string;
    developmentDependency?: boolean;
    serviceable?: boolean;
    requireLicenseAcceptance?: boolean;
    minClientVersion?: string;
    packageTypes?: PackageType[];
}

export interface PackageType {
    name: string;
    version?: string;
}

export interface PackageDependency {
    id: string;
    version?: string;
    targetFramework?: string;
    exclude?: string;
    include?: string;
}

export interface PackageFile {
    path: string;
    name: string;
    size: number;
    isDirectory: boolean;
    children?: PackageFile[];
}

export interface PackageContent {
    metadata: NuGetPackageMetadata;
    files: PackageFile[];
    nuspecContent?: string;
    iconData?: Buffer;
    readmeContent?: string;
    readmePath?: string;
    licenseContent?: string;
    licensePath?: string;
}

export interface FileContent {
    path: string;
    content: Buffer;
    encoding?: string;
    mimeType?: string;
}
