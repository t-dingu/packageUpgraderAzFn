const { exec } = require('child_process');
const path = require('path');
const tmp = require('tmp');
const fs = require('fs');
tmp.setGracefulCleanup();

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    if (req.body && req.body.PackageName && req.body.PackageVersion && req.body.MetadataFiles) {
        var packageJsons = []
        var packageLocks = []

        req.body.MetadataFiles.forEach(async function(packageJsonContents) {
            const updatedFiles = await UpdateMetadataFiles(packageJsonContents, req.body.PackageName, req.body.PackageVersion);
            packageJsons.push(updatedFiles[newPackageJson]);
            packageLocks.push(updatedFiles[newPackageLock]);
        });

        context.res = {
            // status: 200, /* Defaults to 200 */
            body: {
                PackageJsons: packageJsons,
                PackageLocks: packageLocks
            }
        };
    }
    else {
        context.res = {
            status: 400,
            body: "Please pass a package name, version, and metadata files in the request body"
        };
    }
};

async function UpdateMetadataFiles(packageJsonContents, packageName, packageVersion) {
    const tempDir = tmp.dirSync({unsafeCleanup: true});

    const packageJsonPath = path.join(tempDir.name, "package.json");
    // something funky going on here with rejected promises?
    await fs.writeFile(packageJsonPath, packageJsonContents, (error) => {
        console.log(error)
    });

    await createPackageLock(tempDir.name);
    await upgradeDependency(tempDir.name, packageName, packageVersion);    

    try
    {
        const packageLockPath = path.join(tempDir.name, "package-lock.json");

        const newPackageLock = fs.readFileSync(packageLockPath, 'utf8');
        const newPackageJson = fs.readFileSync(packageJsonPath, 'utf8');

        tempDir.removeCallback();

        return { newPackageJson, newPackageLock };
    }
    catch (e)
    {
        tempDir.removeCallback();
        throw e;
    }
}

function createPackageLock(path) {
    return new Promise((resolve, reject) => {
        exec(`npm install -s --package-lock-only`, {cwd: path}, (error, stdout, stderr) => {
            if (error != null) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function upgradeDependency(path, packageName, packageVersion) {
    return new Promise((resolve, reject) => {
        exec(`npm install -s --package-lock-only --save ${packageName}@${packageVersion}`, {cwd: path}, (error, stdout, stderr) => {
            if (error != null) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}