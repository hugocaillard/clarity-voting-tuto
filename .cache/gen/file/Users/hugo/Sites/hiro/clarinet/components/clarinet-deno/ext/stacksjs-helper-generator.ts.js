// Clarinet extention #1
//
// This extension is introspecting the contracts of the project it's running from,
// and produce a Typescript data structure autocomplete friendly, that developers
// can use in their frontend code.
//
// When running:
// $ clarinet run --allow-write scripts/stacksjs-helper-generator.ts
//
// This script will write a file at the path artifacts/contracts.ts:
//
// export namespace CounterContract {
//     export const address = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
//     export const name = "counter";
//     export namespace Functions {
//         export namespace Increment {
//             export const name = "increment";
//             export interface IncrementArgs {
//                 step: ClarityValue,
//             }
//             export function args(args: IncrementArgs): ClarityValue[] {
//                 return [
//                     args.step,
//                 ];
//             }
//         }
//         // read-counter
//         export namespace ReadCounter {
//             export const name = "read-counter";
//
//         }
//     }
// }
//
// By importing this file in their frontend code, developers can use constants, instead
// of hard coding principals and strings:
//
// await makeContractCall({
//     contractAddress: CounterContract.address,
//     contractName: CounterContract.name,
//     functionName: CounterContract.Functions.Increment.name,
//     functionArgs: CounterContract.Functions.Increment.args({ step: uintCV(10); }),
//     ...
// }
import { Clarinet } from "../index.ts";
function typeToCVType(argType) {
    switch(argType){
        case "bool":
            return "BooleanCV";
        case "int128":
            return "IntCV";
        case "uint128":
            return "UIntCV";
        case "principal":
            return "PrincipalCV";
        case "response":
            return "ResponseCV";
        default:
            switch(Object.keys(argType)[0]){
                case "buffer":
                    return "BufferCV";
                case "optional":
                    return "NoneCV";
                case "list":
                    return "ListCV";
                case "tuple":
                    return "TupleCV";
                case "string-ascii":
                    return "StringAsciiCV";
                case "string-utf8":
                    return "StringUtf8CV";
                default:
                    return "ClarityValue";
            }
    }
}
Clarinet.run({
    fn (_accounts, contracts, _node) {
        const code = [];
        code.push([
            `// Code generated with the stacksjs-helper-generator extension`,
            `// Manual edits will be overwritten`,
            ``,
            `import { ClarityValue, BooleanCV, IntCV, UIntCV, BufferCV, OptionalCV, ResponseCV, PrincipalCV, ListCV, TupleCV, StringAsciiCV, StringUtf8CV, NoneCV } from "@stacks/transactions"`,
            ``, 
        ]);
        for (const [contractId, contract] of contracts){
            const [address, name] = contractId.split(".");
            code.push([
                `export namespace ${kebabToCamel(capitalize(name))}Contract {`,
                `    export const address = "${address}";`,
                `    export const name = "${name}";`,
                ``, 
            ]);
            const functions = [];
            for (const func of contract.contract_interface.functions){
                if (func.access === "public") {
                    functions.push(func);
                } else if (func.access === "read_only") {
                    functions.push(func);
                }
            }
            if (functions.length > 0) {
                code.push([
                    `    // Functions`,
                    `    export namespace Functions {`
                ]);
                for (const f of functions){
                    code.push([
                        `        // ${f.name}`,
                        `        export namespace ${kebabToCamel(capitalize(f.name))} {`,
                        `            export const name = "${f.name}";`,
                        ``, 
                    ]);
                    if (f.args.length > 0) {
                        // Generate code for interface
                        code.push([
                            `            export interface ${kebabToCamel(capitalize(f.name))}Args {`, 
                        ]);
                        for (const arg of f.args){
                            code.push([
                                `                ${kebabToCamel(arg.name)}: ${typeToCVType(arg.type)},`, 
                            ]);
                        }
                        code.push([
                            `            }`,
                            ``
                        ]);
                        // Generate code for helper function
                        code.push([
                            `            export function args(args: ${kebabToCamel(capitalize(f.name))}Args): ClarityValue[] {`,
                            `                return [`, 
                        ]);
                        for (const arg1 of f.args){
                            code.push([
                                `                    args.${kebabToCamel(arg1.name)},`, 
                            ]);
                        }
                        code.push([
                            `                ];`,
                            `            }`,
                            ``
                        ]);
                    }
                    code.push([
                        `        }`,
                        ``
                    ]);
                }
                code.push([
                    `    }`
                ]);
            }
            code.push([
                `}`,
                ``
            ]);
        }
        try {
            Deno.statSync("./artifacts");
        } catch (_) {
            Deno.mkdirSync("./artifacts");
        }
        Deno.writeTextFileSync("./artifacts/contracts.ts", code.flat().join("\n"));
    }
});
function capitalize(source) {
    return source[0].toUpperCase() + source.slice(1);
}
function kebabToCamel(source) {
    return source.replace(/[^\w\-\_]/g, "").replace(/(-\w)/g, (x)=>x[1].toUpperCase());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vVXNlcnMvaHVnby9TaXRlcy9oaXJvL2NsYXJpbmV0L2NvbXBvbmVudHMvY2xhcmluZXQtZGVuby9leHQvc3RhY2tzanMtaGVscGVyLWdlbmVyYXRvci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDbGFyaW5ldCBleHRlbnRpb24gIzFcbi8vXG4vLyBUaGlzIGV4dGVuc2lvbiBpcyBpbnRyb3NwZWN0aW5nIHRoZSBjb250cmFjdHMgb2YgdGhlIHByb2plY3QgaXQncyBydW5uaW5nIGZyb20sXG4vLyBhbmQgcHJvZHVjZSBhIFR5cGVzY3JpcHQgZGF0YSBzdHJ1Y3R1cmUgYXV0b2NvbXBsZXRlIGZyaWVuZGx5LCB0aGF0IGRldmVsb3BlcnNcbi8vIGNhbiB1c2UgaW4gdGhlaXIgZnJvbnRlbmQgY29kZS5cbi8vXG4vLyBXaGVuIHJ1bm5pbmc6XG4vLyAkIGNsYXJpbmV0IHJ1biAtLWFsbG93LXdyaXRlIHNjcmlwdHMvc3RhY2tzanMtaGVscGVyLWdlbmVyYXRvci50c1xuLy9cbi8vIFRoaXMgc2NyaXB0IHdpbGwgd3JpdGUgYSBmaWxlIGF0IHRoZSBwYXRoIGFydGlmYWN0cy9jb250cmFjdHMudHM6XG4vL1xuLy8gZXhwb3J0IG5hbWVzcGFjZSBDb3VudGVyQ29udHJhY3Qge1xuLy8gICAgIGV4cG9ydCBjb25zdCBhZGRyZXNzID0gXCJTVDFQUUhRS1YwUkpYWkZZMURHWDhNTlNOWVZFM1ZHWkpTUlRQR1pHTVwiO1xuLy8gICAgIGV4cG9ydCBjb25zdCBuYW1lID0gXCJjb3VudGVyXCI7XG4vLyAgICAgZXhwb3J0IG5hbWVzcGFjZSBGdW5jdGlvbnMge1xuLy8gICAgICAgICBleHBvcnQgbmFtZXNwYWNlIEluY3JlbWVudCB7XG4vLyAgICAgICAgICAgICBleHBvcnQgY29uc3QgbmFtZSA9IFwiaW5jcmVtZW50XCI7XG4vLyAgICAgICAgICAgICBleHBvcnQgaW50ZXJmYWNlIEluY3JlbWVudEFyZ3Mge1xuLy8gICAgICAgICAgICAgICAgIHN0ZXA6IENsYXJpdHlWYWx1ZSxcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgIGV4cG9ydCBmdW5jdGlvbiBhcmdzKGFyZ3M6IEluY3JlbWVudEFyZ3MpOiBDbGFyaXR5VmFsdWVbXSB7XG4vLyAgICAgICAgICAgICAgICAgcmV0dXJuIFtcbi8vICAgICAgICAgICAgICAgICAgICAgYXJncy5zdGVwLFxuLy8gICAgICAgICAgICAgICAgIF07XG4vLyAgICAgICAgICAgICB9XG4vLyAgICAgICAgIH1cbi8vICAgICAgICAgLy8gcmVhZC1jb3VudGVyXG4vLyAgICAgICAgIGV4cG9ydCBuYW1lc3BhY2UgUmVhZENvdW50ZXIge1xuLy8gICAgICAgICAgICAgZXhwb3J0IGNvbnN0IG5hbWUgPSBcInJlYWQtY291bnRlclwiO1xuLy9cbi8vICAgICAgICAgfVxuLy8gICAgIH1cbi8vIH1cbi8vXG4vLyBCeSBpbXBvcnRpbmcgdGhpcyBmaWxlIGluIHRoZWlyIGZyb250ZW5kIGNvZGUsIGRldmVsb3BlcnMgY2FuIHVzZSBjb25zdGFudHMsIGluc3RlYWRcbi8vIG9mIGhhcmQgY29kaW5nIHByaW5jaXBhbHMgYW5kIHN0cmluZ3M6XG4vL1xuLy8gYXdhaXQgbWFrZUNvbnRyYWN0Q2FsbCh7XG4vLyAgICAgY29udHJhY3RBZGRyZXNzOiBDb3VudGVyQ29udHJhY3QuYWRkcmVzcyxcbi8vICAgICBjb250cmFjdE5hbWU6IENvdW50ZXJDb250cmFjdC5uYW1lLFxuLy8gICAgIGZ1bmN0aW9uTmFtZTogQ291bnRlckNvbnRyYWN0LkZ1bmN0aW9ucy5JbmNyZW1lbnQubmFtZSxcbi8vICAgICBmdW5jdGlvbkFyZ3M6IENvdW50ZXJDb250cmFjdC5GdW5jdGlvbnMuSW5jcmVtZW50LmFyZ3MoeyBzdGVwOiB1aW50Q1YoMTApOyB9KSxcbi8vICAgICAuLi5cbi8vIH1cblxuaW1wb3J0IHsgQWNjb3VudCwgQ2xhcmluZXQsIENvbnRyYWN0LCBTdGFja3NOb2RlIH0gZnJvbSBcIi4uL2luZGV4LnRzXCI7XG5cbmZ1bmN0aW9uIHR5cGVUb0NWVHlwZShhcmdUeXBlOiBhbnkpIHtcbiAgc3dpdGNoIChhcmdUeXBlKSB7XG4gICAgY2FzZSBcImJvb2xcIjpcbiAgICAgIHJldHVybiBcIkJvb2xlYW5DVlwiO1xuICAgIGNhc2UgXCJpbnQxMjhcIjpcbiAgICAgIHJldHVybiBcIkludENWXCI7XG4gICAgY2FzZSBcInVpbnQxMjhcIjpcbiAgICAgIHJldHVybiBcIlVJbnRDVlwiO1xuICAgIGNhc2UgXCJwcmluY2lwYWxcIjpcbiAgICAgIHJldHVybiBcIlByaW5jaXBhbENWXCI7XG4gICAgY2FzZSBcInJlc3BvbnNlXCI6XG4gICAgICByZXR1cm4gXCJSZXNwb25zZUNWXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN3aXRjaCAoT2JqZWN0LmtleXMoYXJnVHlwZSlbMF0pIHtcbiAgICAgICAgY2FzZSBcImJ1ZmZlclwiOlxuICAgICAgICAgIHJldHVybiBcIkJ1ZmZlckNWXCI7XG4gICAgICAgIGNhc2UgXCJvcHRpb25hbFwiOlxuICAgICAgICAgIHJldHVybiBcIk5vbmVDVlwiO1xuICAgICAgICBjYXNlIFwibGlzdFwiOlxuICAgICAgICAgIHJldHVybiBcIkxpc3RDVlwiO1xuICAgICAgICBjYXNlIFwidHVwbGVcIjpcbiAgICAgICAgICByZXR1cm4gXCJUdXBsZUNWXCI7XG4gICAgICAgIGNhc2UgXCJzdHJpbmctYXNjaWlcIjpcbiAgICAgICAgICByZXR1cm4gXCJTdHJpbmdBc2NpaUNWXCI7XG4gICAgICAgIGNhc2UgXCJzdHJpbmctdXRmOFwiOlxuICAgICAgICAgIHJldHVybiBcIlN0cmluZ1V0ZjhDVlwiO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBcIkNsYXJpdHlWYWx1ZVwiO1xuICAgICAgfVxuICB9XG59XG5cbkNsYXJpbmV0LnJ1bih7XG4gIGZuKFxuICAgIF9hY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4sXG4gICAgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD4sXG4gICAgX25vZGU6IFN0YWNrc05vZGVcbiAgKSB7XG4gICAgY29uc3QgY29kZSA9IFtdO1xuICAgIGNvZGUucHVzaChbXG4gICAgICBgLy8gQ29kZSBnZW5lcmF0ZWQgd2l0aCB0aGUgc3RhY2tzanMtaGVscGVyLWdlbmVyYXRvciBleHRlbnNpb25gLFxuICAgICAgYC8vIE1hbnVhbCBlZGl0cyB3aWxsIGJlIG92ZXJ3cml0dGVuYCxcbiAgICAgIGBgLFxuICAgICAgYGltcG9ydCB7IENsYXJpdHlWYWx1ZSwgQm9vbGVhbkNWLCBJbnRDViwgVUludENWLCBCdWZmZXJDViwgT3B0aW9uYWxDViwgUmVzcG9uc2VDViwgUHJpbmNpcGFsQ1YsIExpc3RDViwgVHVwbGVDViwgU3RyaW5nQXNjaWlDViwgU3RyaW5nVXRmOENWLCBOb25lQ1YgfSBmcm9tIFwiQHN0YWNrcy90cmFuc2FjdGlvbnNcImAsXG4gICAgICBgYCxcbiAgICBdKTtcblxuICAgIGZvciAoY29uc3QgW2NvbnRyYWN0SWQsIGNvbnRyYWN0XSBvZiBjb250cmFjdHMpIHtcbiAgICAgIGNvbnN0IFthZGRyZXNzLCBuYW1lXSA9IGNvbnRyYWN0SWQuc3BsaXQoXCIuXCIpO1xuICAgICAgY29kZS5wdXNoKFtcbiAgICAgICAgYGV4cG9ydCBuYW1lc3BhY2UgJHtrZWJhYlRvQ2FtZWwoY2FwaXRhbGl6ZShuYW1lKSl9Q29udHJhY3Qge2AsXG4gICAgICAgIGAgICAgZXhwb3J0IGNvbnN0IGFkZHJlc3MgPSBcIiR7YWRkcmVzc31cIjtgLFxuICAgICAgICBgICAgIGV4cG9ydCBjb25zdCBuYW1lID0gXCIke25hbWV9XCI7YCxcbiAgICAgICAgYGAsXG4gICAgICBdKTtcblxuICAgICAgY29uc3QgZnVuY3Rpb25zID0gW107XG5cbiAgICAgIGZvciAoY29uc3QgZnVuYyBvZiBjb250cmFjdC5jb250cmFjdF9pbnRlcmZhY2UuZnVuY3Rpb25zKSB7XG4gICAgICAgIGlmIChmdW5jLmFjY2VzcyA9PT0gXCJwdWJsaWNcIikge1xuICAgICAgICAgIGZ1bmN0aW9ucy5wdXNoKGZ1bmMpO1xuICAgICAgICB9IGVsc2UgaWYgKGZ1bmMuYWNjZXNzID09PSBcInJlYWRfb25seVwiKSB7XG4gICAgICAgICAgZnVuY3Rpb25zLnB1c2goZnVuYyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZ1bmN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvZGUucHVzaChbYCAgICAvLyBGdW5jdGlvbnNgLCBgICAgIGV4cG9ydCBuYW1lc3BhY2UgRnVuY3Rpb25zIHtgXSk7XG4gICAgICAgIGZvciAoY29uc3QgZiBvZiBmdW5jdGlvbnMpIHtcbiAgICAgICAgICBjb2RlLnB1c2goW1xuICAgICAgICAgICAgYCAgICAgICAgLy8gJHtmLm5hbWV9YCxcbiAgICAgICAgICAgIGAgICAgICAgIGV4cG9ydCBuYW1lc3BhY2UgJHtrZWJhYlRvQ2FtZWwoY2FwaXRhbGl6ZShmLm5hbWUpKX0ge2AsXG4gICAgICAgICAgICBgICAgICAgICAgICAgZXhwb3J0IGNvbnN0IG5hbWUgPSBcIiR7Zi5uYW1lfVwiO2AsXG4gICAgICAgICAgICBgYCxcbiAgICAgICAgICBdKTtcblxuICAgICAgICAgIGlmIChmLmFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gR2VuZXJhdGUgY29kZSBmb3IgaW50ZXJmYWNlXG4gICAgICAgICAgICBjb2RlLnB1c2goW1xuICAgICAgICAgICAgICBgICAgICAgICAgICAgZXhwb3J0IGludGVyZmFjZSAke2tlYmFiVG9DYW1lbChcbiAgICAgICAgICAgICAgICBjYXBpdGFsaXplKGYubmFtZSlcbiAgICAgICAgICAgICAgKX1BcmdzIHtgLFxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGFyZyBvZiBmLmFyZ3MpIHtcbiAgICAgICAgICAgICAgY29kZS5wdXNoKFtcbiAgICAgICAgICAgICAgICBgICAgICAgICAgICAgICAgICR7a2ViYWJUb0NhbWVsKGFyZy5uYW1lKX06ICR7dHlwZVRvQ1ZUeXBlKFxuICAgICAgICAgICAgICAgICAgYXJnLnR5cGVcbiAgICAgICAgICAgICAgICApfSxgLFxuICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvZGUucHVzaChbYCAgICAgICAgICAgIH1gLCBgYF0pO1xuXG4gICAgICAgICAgICAvLyBHZW5lcmF0ZSBjb2RlIGZvciBoZWxwZXIgZnVuY3Rpb25cbiAgICAgICAgICAgIGNvZGUucHVzaChbXG4gICAgICAgICAgICAgIGAgICAgICAgICAgICBleHBvcnQgZnVuY3Rpb24gYXJncyhhcmdzOiAke2tlYmFiVG9DYW1lbChcbiAgICAgICAgICAgICAgICBjYXBpdGFsaXplKGYubmFtZSlcbiAgICAgICAgICAgICAgKX1BcmdzKTogQ2xhcml0eVZhbHVlW10ge2AsXG4gICAgICAgICAgICAgIGAgICAgICAgICAgICAgICAgcmV0dXJuIFtgLFxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGFyZyBvZiBmLmFyZ3MpIHtcbiAgICAgICAgICAgICAgY29kZS5wdXNoKFtcbiAgICAgICAgICAgICAgICBgICAgICAgICAgICAgICAgICAgICBhcmdzLiR7a2ViYWJUb0NhbWVsKGFyZy5uYW1lKX0sYCxcbiAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlLnB1c2goW2AgICAgICAgICAgICAgICAgXTtgLCBgICAgICAgICAgICAgfWAsIGBgXSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29kZS5wdXNoKFtgICAgICAgICB9YCwgYGBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUucHVzaChbYCAgICB9YF0pO1xuICAgICAgfVxuXG4gICAgICBjb2RlLnB1c2goW2B9YCwgYGBdKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgRGVuby5zdGF0U3luYyhcIi4vYXJ0aWZhY3RzXCIpO1xuICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgIERlbm8ubWtkaXJTeW5jKFwiLi9hcnRpZmFjdHNcIik7XG4gICAgfVxuXG4gICAgRGVuby53cml0ZVRleHRGaWxlU3luYyhcIi4vYXJ0aWZhY3RzL2NvbnRyYWN0cy50c1wiLCBjb2RlLmZsYXQoKS5qb2luKFwiXFxuXCIpKTtcbiAgfSxcbn0pO1xuXG5mdW5jdGlvbiBjYXBpdGFsaXplKHNvdXJjZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHNvdXJjZVswXS50b1VwcGVyQ2FzZSgpICsgc291cmNlLnNsaWNlKDEpO1xufVxuXG5mdW5jdGlvbiBrZWJhYlRvQ2FtZWwoc291cmNlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc291cmNlXG4gICAgLnJlcGxhY2UoL1teXFx3XFwtXFxfXS9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC8oLVxcdykvZywgKHgpID0+IHhbMV0udG9VcHBlckNhc2UoKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRixrRkFBa0Y7QUFDbEYsaUZBQWlGO0FBQ2pGLGtDQUFrQztBQUNsQyxFQUFFO0FBQ0YsZ0JBQWdCO0FBQ2hCLG9FQUFvRTtBQUNwRSxFQUFFO0FBQ0Ysb0VBQW9FO0FBQ3BFLEVBQUU7QUFDRixxQ0FBcUM7QUFDckMsMEVBQTBFO0FBQzFFLHFDQUFxQztBQUNyQyxtQ0FBbUM7QUFDbkMsdUNBQXVDO0FBQ3ZDLCtDQUErQztBQUMvQywrQ0FBK0M7QUFDL0Msc0NBQXNDO0FBQ3RDLGdCQUFnQjtBQUNoQiwwRUFBMEU7QUFDMUUsMkJBQTJCO0FBQzNCLGlDQUFpQztBQUNqQyxxQkFBcUI7QUFDckIsZ0JBQWdCO0FBQ2hCLFlBQVk7QUFDWiwwQkFBMEI7QUFDMUIseUNBQXlDO0FBQ3pDLGtEQUFrRDtBQUNsRCxFQUFFO0FBQ0YsWUFBWTtBQUNaLFFBQVE7QUFDUixJQUFJO0FBQ0osRUFBRTtBQUNGLHVGQUF1RjtBQUN2Rix5Q0FBeUM7QUFDekMsRUFBRTtBQUNGLDJCQUEyQjtBQUMzQixn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