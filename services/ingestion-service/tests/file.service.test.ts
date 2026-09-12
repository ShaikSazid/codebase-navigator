// import { describe, expect, it } from "vitest";
// import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
// import os from "os";
// import path from "path";

// import { readRepositoryFiles } from "../src/services/file.service.js";

// describe("readRepositoryFiles", () => {

//     it("should recursively read repository files", async () => {
//         const repositoryPath = await mkdtemp(
//             path.join(os.tmpdir(), "test-repository-")
//         );

//         try {
//             await mkdir(path.join(repositoryPath, "src"));

//             await writeFile(
//                 path.join(repositoryPath, "package.json"),
//                 '{"name":"test-repository"}'
//             );

//             await writeFile(
//                 path.join(repositoryPath, "src", "index.ts"),
//                 'console.log("hello");'
//             );

//             const files = await readRepositoryFiles(repositoryPath);

//             expect(files).toHaveLength(2);

//             expect(files).toEqual(
//                 expect.arrayContaining([
//                     {
//                         path: "package.json",
//                         content: '{"name":"test-repository"}',
//                     },
//                     {
//                         path: path.join("src", "index.ts"),
//                         content: 'console.log("hello");',
//                     },
//                 ])
//             );

//         } finally {
//             await rm(repositoryPath, {
//                 recursive: true,
//                 force: true,
//             });
//         }
//     });
//     it("should ignore binary files", async () => {
//         const repositoryPath = await mkdtemp(
//             path.join(os.tmpdir(), "test-repository-")
//         );

//         try {
//             const binaryContent = Buffer.from([
//                 0x00,
//                 0x01,
//                 0x02,
//                 0x03,
//                 0xff,
//             ]);

//             await writeFile(
//                 path.join(repositoryPath, "binary-file"),
//                 binaryContent
//             );

//             const files = await readRepositoryFiles(repositoryPath);

//             expect(files).toHaveLength(0);
//         } finally {
//             await rm(repositoryPath, {
//                 recursive: true,
//                 force: true,
//             });
//         }
//     });


//     it("should ignore files larger than the maximum size", async () => {
//         const repositoryPath = await mkdtemp(
//             path.join(os.tmpdir(), "test-repository-")
//         );

//         try {
//             const largeContent = "a".repeat(1.1 * 1024 * 1024);

//             await writeFile(
//                 path.join(repositoryPath, "large-file.txt"),
//                 largeContent
//             );

//             const files = await readRepositoryFiles(repositoryPath);

//             expect(files).toHaveLength(0);

//         } finally {
//             await rm(repositoryPath, {
//                 recursive: true,
//                 force: true,
//             });
//         }
//     });

// });