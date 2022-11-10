export * from "./types.ts";
export class Tx {
    type;
    sender;
    contractCall;
    transferStx;
    deployContract;
    constructor(type, sender){
        this.type = type;
        this.sender = sender;
    }
    static transferSTX(amount, recipient, sender) {
        const tx = new Tx(1, sender);
        tx.transferStx = {
            recipient,
            amount
        };
        return tx;
    }
    static contractCall(contract, method, args, sender) {
        const tx = new Tx(2, sender);
        tx.contractCall = {
            contract,
            method,
            args
        };
        return tx;
    }
    static deployContract(name, code, sender) {
        const tx = new Tx(3, sender);
        tx.deployContract = {
            name,
            code
        };
        return tx;
    }
}
export class Chain {
    sessionId;
    blockHeight = 1;
    constructor(sessionId){
        this.sessionId = sessionId;
    }
    mineBlock(transactions) {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/mine_block", {
            sessionId: this.sessionId,
            transactions: transactions
        }));
        this.blockHeight = result.block_height;
        const block = {
            height: result.block_height,
            receipts: result.receipts
        };
        return block;
    }
    mineEmptyBlock(count) {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/mine_empty_blocks", {
            sessionId: this.sessionId,
            count: count
        }));
        this.blockHeight = result.block_height;
        const emptyBlock = {
            session_id: result.session_id,
            block_height: result.block_height
        };
        return emptyBlock;
    }
    mineEmptyBlockUntil(targetBlockHeight) {
        const count = targetBlockHeight - this.blockHeight;
        if (count < 0) {
            throw new Error(`Chain tip cannot be moved from ${this.blockHeight} to ${targetBlockHeight}`);
        }
        return this.mineEmptyBlock(count);
    }
    callReadOnlyFn(contract, method, args, sender) {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/call_read_only_fn", {
            sessionId: this.sessionId,
            contract: contract,
            method: method,
            args: args,
            sender: sender
        }));
        const readOnlyFn = {
            session_id: result.session_id,
            result: result.result,
            events: result.events
        };
        return readOnlyFn;
    }
    getAssetsMaps() {
        const result = JSON.parse(// @ts-ignore
        Deno.core.opSync("api/v1/get_assets_maps", {
            sessionId: this.sessionId
        }));
        const assetsMaps = {
            session_id: result.session_id,
            assets: result.assets
        };
        return assetsMaps;
    }
}
export class Clarinet {
    static test(options) {
        // @ts-ignore
        Deno.test({
            name: options.name,
            only: options.only,
            ignore: options.ignore,
            async fn () {
                const hasPreDeploymentSteps = options.preDeployment !== undefined;
                let result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
                    name: options.name,
                    loadDeployment: !hasPreDeploymentSteps,
                    deploymentPath: options.deploymentPath
                }));
                if (options.preDeployment) {
                    const chain = new Chain(result.session_id);
                    const accounts = new Map();
                    for (const account of result.accounts){
                        accounts.set(account.name, account);
                    }
                    await options.preDeployment(chain, accounts);
                    result = JSON.parse(// @ts-ignore
                    Deno.core.opSync("api/v1/load_deployment", {
                        sessionId: chain.sessionId,
                        deploymentPath: options.deploymentPath
                    }));
                }
                const chain1 = new Chain(result.session_id);
                const accounts1 = new Map();
                for (const account1 of result.accounts){
                    accounts1.set(account1.name, account1);
                }
                const contracts = new Map();
                for (const contract of result.contracts){
                    contracts.set(contract.contract_id, contract);
                }
                await options.fn(chain1, accounts1, contracts);
                JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/terminate_session", {
                    sessionId: chain1.sessionId
                }));
            }
        });
    }
    static run(options) {
        // @ts-ignore
        Deno.test({
            name: "running script",
            async fn () {
                const result = JSON.parse(// @ts-ignore
                Deno.core.opSync("api/v1/new_session", {
                    name: "running script",
                    loadDeployment: true,
                    deploymentPath: undefined
                }));
                const accounts = new Map();
                for (const account of result.accounts){
                    accounts.set(account.name, account);
                }
                const contracts = new Map();
                for (const contract of result.contracts){
                    contracts.set(contract.contract_id, contract);
                }
                const stacks_node = {
                    url: result.stacks_node_url
                };
                await options.fn(accounts, contracts, stacks_node);
            }
        });
    }
}
export var types;
(function(types) {
    const byteToHex = [];
    for(let n = 0; n <= 0xff; ++n){
        const hexOctet = n.toString(16).padStart(2, "0");
        byteToHex.push(hexOctet);
    }
    function serializeTuple(input) {
        const items = [];
        for (const [key, value] of Object.entries(input)){
            if (Array.isArray(value)) {
                throw new Error("Tuple value can't be an array");
            } else if (!!value && typeof value === "object") {
                items.push(`${key}: { ${serializeTuple(value)} }`);
            } else {
                items.push(`${key}: ${value}`);
            }
        }
        return items.join(", ");
    }
    function ok(val) {
        return `(ok ${val})`;
    }
    types.ok = ok;
    function err(val) {
        return `(err ${val})`;
    }
    types.err = err;
    function some(val) {
        return `(some ${val})`;
    }
    types.some = some;
    function none() {
        return `none`;
    }
    types.none = none;
    function bool(val) {
        return `${val}`;
    }
    types.bool = bool;
    function int(val) {
        return `${val}`;
    }
    types.int = int;
    function uint(val) {
        return `u${val}`;
    }
    types.uint = uint;
    function ascii(val) {
        return JSON.stringify(val);
    }
    types.ascii = ascii;
    function utf8(val) {
        return `u${JSON.stringify(val)}`;
    }
    types.utf8 = utf8;
    function buff(val) {
        const buff = typeof val == "string" ? new TextEncoder().encode(val) : new Uint8Array(val);
        const hexOctets = new Array(buff.length);
        for(let i = 0; i < buff.length; ++i){
            hexOctets[i] = byteToHex[buff[i]];
        }
        return `0x${hexOctets.join("")}`;
    }
    types.buff = buff;
    function list(val) {
        return `(list ${val.join(" ")})`;
    }
    types.list = list;
    function principal(val) {
        return `'${val}`;
    }
    types.principal = principal;
    function tuple(val) {
        return `{ ${serializeTuple(val)} }`;
    }
    types.tuple = tuple;
})(types || (types = {}));
// deno-lint-ignore ban-types
function consume(src, expectation, wrapped) {
    let dst = (" " + src).slice(1);
    let size = expectation.length;
    if (!wrapped && src !== expectation) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    if (wrapped) {
        size += 2;
    }
    if (dst.length < size) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    if (wrapped) {
        dst = dst.substring(1, dst.length - 1);
    }
    const res = dst.slice(0, expectation.length);
    if (res !== expectation) {
        throw new Error(`Expected ${green(expectation.toString())}, got ${red(src.toString())}`);
    }
    let leftPad = 0;
    if (dst.charAt(expectation.length) === " ") {
        leftPad = 1;
    }
    const remainder = dst.substring(expectation.length + leftPad);
    return remainder;
}
String.prototype.expectOk = function() {
    return consume(this, "ok", true);
};
String.prototype.expectErr = function() {
    return consume(this, "err", true);
};
String.prototype.expectSome = function() {
    return consume(this, "some", true);
};
String.prototype.expectNone = function() {
    return consume(this, "none", false);
};
String.prototype.expectBool = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectUint = function(value) {
    try {
        consume(this, `u${value}`, false);
    } catch (error) {
        throw error;
    }
    return BigInt(value);
};
String.prototype.expectInt = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return BigInt(value);
};
String.prototype.expectBuff = function(value) {
    const buffer = types.buff(value);
    if (this !== buffer) {
        throw new Error(`Expected ${green(buffer)}, got ${red(this.toString())}`);
    }
    return value;
};
String.prototype.expectAscii = function(value) {
    try {
        consume(this, `"${value}"`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectUtf8 = function(value) {
    try {
        consume(this, `u"${value}"`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectPrincipal = function(value) {
    try {
        consume(this, `${value}`, false);
    } catch (error) {
        throw error;
    }
    return value;
};
String.prototype.expectList = function() {
    if (this.charAt(0) !== "[" || this.charAt(this.length - 1) !== "]") {
        throw new Error(`Expected ${green("(list ...)")}, got ${red(this.toString())}`);
    }
    const stack = [];
    const elements = [];
    let start = 1;
    for(let i = 0; i < this.length; i++){
        if (this.charAt(i) === "," && stack.length == 1) {
            elements.push(this.substring(start, i));
            start = i + 2;
        }
        if ([
            "(",
            "[",
            "{"
        ].includes(this.charAt(i))) {
            stack.push(this.charAt(i));
        }
        if (this.charAt(i) === ")" && stack[stack.length - 1] === "(") {
            stack.pop();
        }
        if (this.charAt(i) === "}" && stack[stack.length - 1] === "{") {
            stack.pop();
        }
        if (this.charAt(i) === "]" && stack[stack.length - 1] === "[") {
            stack.pop();
        }
    }
    const remainder = this.substring(start, this.length - 1);
    if (remainder.length > 0) {
        elements.push(remainder);
    }
    return elements;
};
String.prototype.expectTuple = function() {
    if (this.charAt(0) !== "{" || this.charAt(this.length - 1) !== "}") {
        throw new Error(`Expected ${green("(tuple ...)")}, got ${red(this.toString())}`);
    }
    let start = 1;
    const stack = [];
    const elements = [];
    for(let i = 0; i < this.length; i++){
        if (this.charAt(i) === "," && stack.length == 1) {
            elements.push(this.substring(start, i));
            start = i + 2;
        }
        if ([
            "(",
            "[",
            "{"
        ].includes(this.charAt(i))) {
            stack.push(this.charAt(i));
        }
        if (this.charAt(i) === ")" && stack[stack.length - 1] === "(") {
            stack.pop();
        }
        if (this.charAt(i) === "}" && stack[stack.length - 1] === "{") {
            stack.pop();
        }
        if (this.charAt(i) === "]" && stack[stack.length - 1] === "[") {
            stack.pop();
        }
    }
    const remainder = this.substring(start, this.length - 1);
    if (remainder.length > 0) {
        elements.push(remainder);
    }
    const tuple = {};
    for (const element of elements){
        for(let i1 = 0; i1 < element.length; i1++){
            if (element.charAt(i1) === ":") {
                const key = element.substring(0, i1).trim();
                const value = element.substring(i1 + 2).trim();
                tuple[key] = value;
                break;
            }
        }
    }
    return tuple;
};
Array.prototype.expectSTXTransferEvent = function(amount, sender, recipient) {
    for (const event of this){
        try {
            const { stx_transfer_event  } = event;
            return {
                amount: stx_transfer_event.amount.expectInt(amount),
                sender: stx_transfer_event.sender.expectPrincipal(sender),
                recipient: stx_transfer_event.recipient.expectPrincipal(recipient)
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected STXTransferEvent");
};
Array.prototype.expectFungibleTokenTransferEvent = function(amount, sender, recipient, assetId) {
    for (const event of this){
        try {
            const { ft_transfer_event  } = event;
            if (!ft_transfer_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_transfer_event.amount.expectInt(amount),
                sender: ft_transfer_event.sender.expectPrincipal(sender),
                recipient: ft_transfer_event.recipient.expectPrincipal(recipient),
                assetId: ft_transfer_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error(`Unable to retrieve expected FungibleTokenTransferEvent(${amount}, ${sender}, ${recipient}, ${assetId})\n${JSON.stringify(this)}`);
};
Array.prototype.expectFungibleTokenMintEvent = function(amount, recipient, assetId) {
    for (const event of this){
        try {
            const { ft_mint_event  } = event;
            if (!ft_mint_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_mint_event.amount.expectInt(amount),
                recipient: ft_mint_event.recipient.expectPrincipal(recipient),
                assetId: ft_mint_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected FungibleTokenMintEvent");
};
Array.prototype.expectFungibleTokenBurnEvent = function(amount, sender, assetId) {
    for (const event of this){
        try {
            const { ft_burn_event  } = event;
            if (!ft_burn_event.asset_identifier.endsWith(assetId)) continue;
            return {
                amount: ft_burn_event.amount.expectInt(amount),
                sender: ft_burn_event.sender.expectPrincipal(sender),
                assetId: ft_burn_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected FungibleTokenBurnEvent");
};
Array.prototype.expectPrintEvent = function(contractIdentifier, value) {
    for (const event of this){
        try {
            const { contract_event  } = event;
            if (!contract_event.topic.endsWith("print")) continue;
            if (!contract_event.value.endsWith(value)) continue;
            return {
                contract_identifier: contract_event.contract_identifier.expectPrincipal(contractIdentifier),
                topic: contract_event.topic,
                value: contract_event.value
            };
        } catch (error) {
            console.warn(error);
            continue;
        }
    }
    throw new Error("Unable to retrieve expected PrintEvent");
};
Array.prototype.expectNonFungibleTokenTransferEvent = function(tokenId, sender, recipient, assetAddress, assetId) {
    for (const event of this){
        try {
            const { nft_transfer_event  } = event;
            if (nft_transfer_event.value !== tokenId) continue;
            if (nft_transfer_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                tokenId: nft_transfer_event.value,
                sender: nft_transfer_event.sender.expectPrincipal(sender),
                recipient: nft_transfer_event.recipient.expectPrincipal(recipient),
                assetId: nft_transfer_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenTransferEvent");
};
Array.prototype.expectNonFungibleTokenMintEvent = function(tokenId, recipient, assetAddress, assetId) {
    for (const event of this){
        try {
            const { nft_mint_event  } = event;
            if (nft_mint_event.value !== tokenId) continue;
            if (nft_mint_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                tokenId: nft_mint_event.value,
                recipient: nft_mint_event.recipient.expectPrincipal(recipient),
                assetId: nft_mint_event.asset_identifier
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenMintEvent");
};
Array.prototype.expectNonFungibleTokenBurnEvent = function(tokenId, sender, assetAddress, assetId) {
    for (const event of this){
        try {
            if (event.nft_burn_event.value !== tokenId) continue;
            if (event.nft_burn_event.asset_identifier !== `${assetAddress}::${assetId}`) continue;
            return {
                assetId: event.nft_burn_event.asset_identifier,
                tokenId: event.nft_burn_event.value,
                sender: event.nft_burn_event.sender.expectPrincipal(sender)
            };
        } catch (_error) {
            continue;
        }
    }
    throw new Error("Unable to retrieve expected NonFungibleTokenBurnEvent");
};
const noColor = Deno.noColor ?? true;
const enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code) {
    return enabled ? `${code.open}${str.replace(code.regexp, code.open)}${code.close}` : str;
}
export function red(str) {
    return run(str, code([
        31
    ], 39));
}
export function green(str) {
    return run(str, code([
        32
    ], 39));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vVXNlcnMvaHVnby9TaXRlcy9oaXJvL2NsYXJpbmV0L2NvbXBvbmVudHMvY2xhcmluZXQtZGVuby9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBkZW5vLWxpbnQtaWdub3JlLWZpbGUgYmFuLXRzLWNvbW1lbnQgbm8tbmFtZXNwYWNlXG5cbmltcG9ydCB7XG4gIEV4cGVjdEZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQsXG4gIEV4cGVjdEZ1bmdpYmxlVG9rZW5NaW50RXZlbnQsXG4gIEV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50LFxuICBFeHBlY3ROb25GdW5naWJsZVRva2VuQnVybkV2ZW50LFxuICBFeHBlY3ROb25GdW5naWJsZVRva2VuTWludEV2ZW50LFxuICBFeHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCxcbiAgRXhwZWN0UHJpbnRFdmVudCxcbiAgRXhwZWN0U1RYVHJhbnNmZXJFdmVudCxcbn0gZnJvbSBcIi4vdHlwZXMudHNcIjtcblxuZXhwb3J0ICogZnJvbSBcIi4vdHlwZXMudHNcIjtcblxuZXhwb3J0IGNsYXNzIFR4IHtcbiAgdHlwZTogbnVtYmVyO1xuICBzZW5kZXI6IHN0cmluZztcbiAgY29udHJhY3RDYWxsPzogVHhDb250cmFjdENhbGw7XG4gIHRyYW5zZmVyU3R4PzogVHhUcmFuc2ZlcjtcbiAgZGVwbG95Q29udHJhY3Q/OiBUeERlcGxveUNvbnRyYWN0O1xuXG4gIGNvbnN0cnVjdG9yKHR5cGU6IG51bWJlciwgc2VuZGVyOiBzdHJpbmcpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMuc2VuZGVyID0gc2VuZGVyO1xuICB9XG5cbiAgc3RhdGljIHRyYW5zZmVyU1RYKGFtb3VudDogbnVtYmVyLCByZWNpcGllbnQ6IHN0cmluZywgc2VuZGVyOiBzdHJpbmcpIHtcbiAgICBjb25zdCB0eCA9IG5ldyBUeCgxLCBzZW5kZXIpO1xuICAgIHR4LnRyYW5zZmVyU3R4ID0ge1xuICAgICAgcmVjaXBpZW50LFxuICAgICAgYW1vdW50LFxuICAgIH07XG4gICAgcmV0dXJuIHR4O1xuICB9XG5cbiAgc3RhdGljIGNvbnRyYWN0Q2FsbChcbiAgICBjb250cmFjdDogc3RyaW5nLFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZ3M6IEFycmF5PHN0cmluZz4sXG4gICAgc2VuZGVyOiBzdHJpbmdcbiAgKSB7XG4gICAgY29uc3QgdHggPSBuZXcgVHgoMiwgc2VuZGVyKTtcbiAgICB0eC5jb250cmFjdENhbGwgPSB7XG4gICAgICBjb250cmFjdCxcbiAgICAgIG1ldGhvZCxcbiAgICAgIGFyZ3MsXG4gICAgfTtcbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBzdGF0aWMgZGVwbG95Q29udHJhY3QobmFtZTogc3RyaW5nLCBjb2RlOiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nKSB7XG4gICAgY29uc3QgdHggPSBuZXcgVHgoMywgc2VuZGVyKTtcbiAgICB0eC5kZXBsb3lDb250cmFjdCA9IHtcbiAgICAgIG5hbWUsXG4gICAgICBjb2RlLFxuICAgIH07XG4gICAgcmV0dXJuIHR4O1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHhDb250cmFjdENhbGwge1xuICBjb250cmFjdDogc3RyaW5nO1xuICBtZXRob2Q6IHN0cmluZztcbiAgYXJnczogQXJyYXk8c3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeERlcGxveUNvbnRyYWN0IHtcbiAgY29kZTogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHhUcmFuc2ZlciB7XG4gIGFtb3VudDogbnVtYmVyO1xuICByZWNpcGllbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUeFJlY2VpcHQge1xuICByZXN1bHQ6IHN0cmluZztcbiAgZXZlbnRzOiBBcnJheTx1bmtub3duPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCbG9jayB7XG4gIGhlaWdodDogbnVtYmVyO1xuICByZWNlaXB0czogQXJyYXk8VHhSZWNlaXB0Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBY2NvdW50IHtcbiAgYWRkcmVzczogc3RyaW5nO1xuICBiYWxhbmNlOiBudW1iZXI7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGFpbiB7XG4gIHNlc3Npb25JZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRPbmx5Rm4ge1xuICBzZXNzaW9uX2lkOiBudW1iZXI7XG4gIHJlc3VsdDogc3RyaW5nO1xuICBldmVudHM6IEFycmF5PHVua25vd24+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtcHR5QmxvY2sge1xuICBzZXNzaW9uX2lkOiBudW1iZXI7XG4gIGJsb2NrX2hlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzc2V0c01hcHMge1xuICBzZXNzaW9uX2lkOiBudW1iZXI7XG4gIGFzc2V0czoge1xuICAgIFtuYW1lOiBzdHJpbmddOiB7XG4gICAgICBbb3duZXI6IHN0cmluZ106IG51bWJlcjtcbiAgICB9O1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhaW4ge1xuICBzZXNzaW9uSWQ6IG51bWJlcjtcbiAgYmxvY2tIZWlnaHQgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKHNlc3Npb25JZDogbnVtYmVyKSB7XG4gICAgdGhpcy5zZXNzaW9uSWQgPSBzZXNzaW9uSWQ7XG4gIH1cblxuICBtaW5lQmxvY2sodHJhbnNhY3Rpb25zOiBBcnJheTxUeD4pOiBCbG9jayB7XG4gICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvbWluZV9ibG9ja1wiLCB7XG4gICAgICAgIHNlc3Npb25JZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgIHRyYW5zYWN0aW9uczogdHJhbnNhY3Rpb25zLFxuICAgICAgfSlcbiAgICApO1xuICAgIHRoaXMuYmxvY2tIZWlnaHQgPSByZXN1bHQuYmxvY2tfaGVpZ2h0O1xuICAgIGNvbnN0IGJsb2NrOiBCbG9jayA9IHtcbiAgICAgIGhlaWdodDogcmVzdWx0LmJsb2NrX2hlaWdodCxcbiAgICAgIHJlY2VpcHRzOiByZXN1bHQucmVjZWlwdHMsXG4gICAgfTtcbiAgICByZXR1cm4gYmxvY2s7XG4gIH1cblxuICBtaW5lRW1wdHlCbG9jayhjb3VudDogbnVtYmVyKTogRW1wdHlCbG9jayB7XG4gICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvbWluZV9lbXB0eV9ibG9ja3NcIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICBjb3VudDogY291bnQsXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy5ibG9ja0hlaWdodCA9IHJlc3VsdC5ibG9ja19oZWlnaHQ7XG4gICAgY29uc3QgZW1wdHlCbG9jazogRW1wdHlCbG9jayA9IHtcbiAgICAgIHNlc3Npb25faWQ6IHJlc3VsdC5zZXNzaW9uX2lkLFxuICAgICAgYmxvY2tfaGVpZ2h0OiByZXN1bHQuYmxvY2tfaGVpZ2h0LFxuICAgIH07XG4gICAgcmV0dXJuIGVtcHR5QmxvY2s7XG4gIH1cblxuICBtaW5lRW1wdHlCbG9ja1VudGlsKHRhcmdldEJsb2NrSGVpZ2h0OiBudW1iZXIpOiBFbXB0eUJsb2NrIHtcbiAgICBjb25zdCBjb3VudCA9IHRhcmdldEJsb2NrSGVpZ2h0IC0gdGhpcy5ibG9ja0hlaWdodDtcbiAgICBpZiAoY291bnQgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBDaGFpbiB0aXAgY2Fubm90IGJlIG1vdmVkIGZyb20gJHt0aGlzLmJsb2NrSGVpZ2h0fSB0byAke3RhcmdldEJsb2NrSGVpZ2h0fWBcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1pbmVFbXB0eUJsb2NrKGNvdW50KTtcbiAgfVxuXG4gIGNhbGxSZWFkT25seUZuKFxuICAgIGNvbnRyYWN0OiBzdHJpbmcsXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgYXJnczogQXJyYXk8dW5rbm93bj4sXG4gICAgc2VuZGVyOiBzdHJpbmdcbiAgKTogUmVhZE9ubHlGbiB7XG4gICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvY2FsbF9yZWFkX29ubHlfZm5cIiwge1xuICAgICAgICBzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICBjb250cmFjdDogY29udHJhY3QsXG4gICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICBhcmdzOiBhcmdzLFxuICAgICAgICBzZW5kZXI6IHNlbmRlcixcbiAgICAgIH0pXG4gICAgKTtcbiAgICBjb25zdCByZWFkT25seUZuOiBSZWFkT25seUZuID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICByZXN1bHQ6IHJlc3VsdC5yZXN1bHQsXG4gICAgICBldmVudHM6IHJlc3VsdC5ldmVudHMsXG4gICAgfTtcbiAgICByZXR1cm4gcmVhZE9ubHlGbjtcbiAgfVxuXG4gIGdldEFzc2V0c01hcHMoKTogQXNzZXRzTWFwcyB7XG4gICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvZ2V0X2Fzc2V0c19tYXBzXCIsIHtcbiAgICAgICAgc2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBjb25zdCBhc3NldHNNYXBzOiBBc3NldHNNYXBzID0ge1xuICAgICAgc2Vzc2lvbl9pZDogcmVzdWx0LnNlc3Npb25faWQsXG4gICAgICBhc3NldHM6IHJlc3VsdC5hc3NldHMsXG4gICAgfTtcbiAgICByZXR1cm4gYXNzZXRzTWFwcztcbiAgfVxufVxuXG50eXBlIFByZURlcGxveW1lbnRGdW5jdGlvbiA9IChcbiAgY2hhaW46IENoYWluLFxuICBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD5cbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbnR5cGUgVGVzdEZ1bmN0aW9uID0gKFxuICBjaGFpbjogQ2hhaW4sXG4gIGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PixcbiAgY29udHJhY3RzOiBNYXA8c3RyaW5nLCBDb250cmFjdD5cbikgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG5cbmludGVyZmFjZSBVbml0VGVzdE9wdGlvbnMge1xuICBuYW1lOiBzdHJpbmc7XG4gIG9ubHk/OiB0cnVlO1xuICBpZ25vcmU/OiB0cnVlO1xuICBkZXBsb3ltZW50UGF0aD86IHN0cmluZztcbiAgcHJlRGVwbG95bWVudD86IFByZURlcGxveW1lbnRGdW5jdGlvbjtcbiAgZm46IFRlc3RGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb250cmFjdCB7XG4gIGNvbnRyYWN0X2lkOiBzdHJpbmc7XG4gIHNvdXJjZTogc3RyaW5nO1xuICBjb250cmFjdF9pbnRlcmZhY2U6IHVua25vd247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhY2tzTm9kZSB7XG4gIHVybDogc3RyaW5nO1xufVxuXG50eXBlIFNjcmlwdEZ1bmN0aW9uID0gKFxuICBhY2NvdW50czogTWFwPHN0cmluZywgQWNjb3VudD4sXG4gIGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+LFxuICBub2RlOiBTdGFja3NOb2RlXG4pID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG5pbnRlcmZhY2UgU2NyaXB0T3B0aW9ucyB7XG4gIGZuOiBTY3JpcHRGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIENsYXJpbmV0IHtcbiAgc3RhdGljIHRlc3Qob3B0aW9uczogVW5pdFRlc3RPcHRpb25zKSB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIERlbm8udGVzdCh7XG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICBvbmx5OiBvcHRpb25zLm9ubHksXG4gICAgICBpZ25vcmU6IG9wdGlvbnMuaWdub3JlLFxuICAgICAgYXN5bmMgZm4oKSB7XG4gICAgICAgIGNvbnN0IGhhc1ByZURlcGxveW1lbnRTdGVwcyA9IG9wdGlvbnMucHJlRGVwbG95bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICBEZW5vLmNvcmUub3BTeW5jKFwiYXBpL3YxL25ld19zZXNzaW9uXCIsIHtcbiAgICAgICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgICAgICAgIGxvYWREZXBsb3ltZW50OiAhaGFzUHJlRGVwbG95bWVudFN0ZXBzLFxuICAgICAgICAgICAgZGVwbG95bWVudFBhdGg6IG9wdGlvbnMuZGVwbG95bWVudFBhdGgsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAob3B0aW9ucy5wcmVEZXBsb3ltZW50KSB7XG4gICAgICAgICAgY29uc3QgY2hhaW4gPSBuZXcgQ2hhaW4ocmVzdWx0LnNlc3Npb25faWQpO1xuICAgICAgICAgIGNvbnN0IGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PiA9IG5ldyBNYXAoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGFjY291bnQgb2YgcmVzdWx0LmFjY291bnRzKSB7XG4gICAgICAgICAgICBhY2NvdW50cy5zZXQoYWNjb3VudC5uYW1lLCBhY2NvdW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgb3B0aW9ucy5wcmVEZXBsb3ltZW50KGNoYWluLCBhY2NvdW50cyk7XG5cbiAgICAgICAgICByZXN1bHQgPSBKU09OLnBhcnNlKFxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS9sb2FkX2RlcGxveW1lbnRcIiwge1xuICAgICAgICAgICAgICBzZXNzaW9uSWQ6IGNoYWluLnNlc3Npb25JZCxcbiAgICAgICAgICAgICAgZGVwbG95bWVudFBhdGg6IG9wdGlvbnMuZGVwbG95bWVudFBhdGgsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGFpbiA9IG5ldyBDaGFpbihyZXN1bHQuc2Vzc2lvbl9pZCk7XG4gICAgICAgIGNvbnN0IGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PiA9IG5ldyBNYXAoKTtcbiAgICAgICAgZm9yIChjb25zdCBhY2NvdW50IG9mIHJlc3VsdC5hY2NvdW50cykge1xuICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGNvbnRyYWN0IG9mIHJlc3VsdC5jb250cmFjdHMpIHtcbiAgICAgICAgICBjb250cmFjdHMuc2V0KGNvbnRyYWN0LmNvbnRyYWN0X2lkLCBjb250cmFjdCk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgb3B0aW9ucy5mbihjaGFpbiwgYWNjb3VudHMsIGNvbnRyYWN0cyk7XG5cbiAgICAgICAgSlNPTi5wYXJzZShcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgRGVuby5jb3JlLm9wU3luYyhcImFwaS92MS90ZXJtaW5hdGVfc2Vzc2lvblwiLCB7XG4gICAgICAgICAgICBzZXNzaW9uSWQ6IGNoYWluLnNlc3Npb25JZCxcbiAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRpYyBydW4ob3B0aW9uczogU2NyaXB0T3B0aW9ucykge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBEZW5vLnRlc3Qoe1xuICAgICAgbmFtZTogXCJydW5uaW5nIHNjcmlwdFwiLFxuICAgICAgYXN5bmMgZm4oKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgIERlbm8uY29yZS5vcFN5bmMoXCJhcGkvdjEvbmV3X3Nlc3Npb25cIiwge1xuICAgICAgICAgICAgbmFtZTogXCJydW5uaW5nIHNjcmlwdFwiLFxuICAgICAgICAgICAgbG9hZERlcGxveW1lbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXBsb3ltZW50UGF0aDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGFjY291bnRzOiBNYXA8c3RyaW5nLCBBY2NvdW50PiA9IG5ldyBNYXAoKTtcbiAgICAgICAgZm9yIChjb25zdCBhY2NvdW50IG9mIHJlc3VsdC5hY2NvdW50cykge1xuICAgICAgICAgIGFjY291bnRzLnNldChhY2NvdW50Lm5hbWUsIGFjY291bnQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbnRyYWN0czogTWFwPHN0cmluZywgQ29udHJhY3Q+ID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGNvbnRyYWN0IG9mIHJlc3VsdC5jb250cmFjdHMpIHtcbiAgICAgICAgICBjb250cmFjdHMuc2V0KGNvbnRyYWN0LmNvbnRyYWN0X2lkLCBjb250cmFjdCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhY2tzX25vZGU6IFN0YWNrc05vZGUgPSB7XG4gICAgICAgICAgdXJsOiByZXN1bHQuc3RhY2tzX25vZGVfdXJsLFxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBvcHRpb25zLmZuKGFjY291bnRzLCBjb250cmFjdHMsIHN0YWNrc19ub2RlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSB0eXBlcyB7XG4gIGNvbnN0IGJ5dGVUb0hleDogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChsZXQgbiA9IDA7IG4gPD0gMHhmZjsgKytuKSB7XG4gICAgY29uc3QgaGV4T2N0ZXQgPSBuLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCBcIjBcIik7XG4gICAgYnl0ZVRvSGV4LnB1c2goaGV4T2N0ZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VyaWFsaXplVHVwbGUoaW5wdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gICAgY29uc3QgaXRlbXM6IEFycmF5PHN0cmluZz4gPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpbnB1dCkpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUdXBsZSB2YWx1ZSBjYW4ndCBiZSBhbiBhcnJheVwiKTtcbiAgICAgIH0gZWxzZSBpZiAoISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgaXRlbXMucHVzaChcbiAgICAgICAgICBgJHtrZXl9OiB7ICR7c2VyaWFsaXplVHVwbGUodmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pfSB9YFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXRlbXMucHVzaChgJHtrZXl9OiAke3ZhbHVlfWApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXMuam9pbihcIiwgXCIpO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIG9rKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAob2sgJHt2YWx9KWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gZXJyKHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAoZXJyICR7dmFsfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHNvbWUodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYChzb21lICR7dmFsfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIG5vbmUoKSB7XG4gICAgcmV0dXJuIGBub25lYDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBib29sKHZhbDogYm9vbGVhbikge1xuICAgIHJldHVybiBgJHt2YWx9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBpbnQodmFsOiBudW1iZXIgfCBiaWdpbnQpIHtcbiAgICByZXR1cm4gYCR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gdWludCh2YWw6IG51bWJlciB8IGJpZ2ludCkge1xuICAgIHJldHVybiBgdSR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gYXNjaWkodmFsOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsKTtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiB1dGY4KHZhbDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGB1JHtKU09OLnN0cmluZ2lmeSh2YWwpfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gYnVmZih2YWw6IEFycmF5QnVmZmVyIHwgc3RyaW5nKSB7XG4gICAgY29uc3QgYnVmZiA9XG4gICAgICB0eXBlb2YgdmFsID09IFwic3RyaW5nXCJcbiAgICAgICAgPyBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodmFsKVxuICAgICAgICA6IG5ldyBVaW50OEFycmF5KHZhbCk7XG5cbiAgICBjb25zdCBoZXhPY3RldHMgPSBuZXcgQXJyYXkoYnVmZi5sZW5ndGgpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmLmxlbmd0aDsgKytpKSB7XG4gICAgICBoZXhPY3RldHNbaV0gPSBieXRlVG9IZXhbYnVmZltpXV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGAweCR7aGV4T2N0ZXRzLmpvaW4oXCJcIil9YDtcbiAgfVxuXG4gIGV4cG9ydCBmdW5jdGlvbiBsaXN0KHZhbDogQXJyYXk8dW5rbm93bj4pIHtcbiAgICByZXR1cm4gYChsaXN0ICR7dmFsLmpvaW4oXCIgXCIpfSlgO1xuICB9XG5cbiAgZXhwb3J0IGZ1bmN0aW9uIHByaW5jaXBhbCh2YWw6IHN0cmluZykge1xuICAgIHJldHVybiBgJyR7dmFsfWA7XG4gIH1cblxuICBleHBvcnQgZnVuY3Rpb24gdHVwbGUodmFsOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikge1xuICAgIHJldHVybiBgeyAke3NlcmlhbGl6ZVR1cGxlKHZhbCl9IH1gO1xuICB9XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIFN0cmluZyB7XG4gICAgZXhwZWN0T2soKTogc3RyaW5nO1xuICAgIGV4cGVjdEVycigpOiBzdHJpbmc7XG4gICAgZXhwZWN0U29tZSgpOiBzdHJpbmc7XG4gICAgZXhwZWN0Tm9uZSgpOiB2b2lkO1xuICAgIGV4cGVjdEJvb2wodmFsdWU6IGJvb2xlYW4pOiBib29sZWFuO1xuICAgIGV4cGVjdFVpbnQodmFsdWU6IG51bWJlciB8IGJpZ2ludCk6IGJpZ2ludDtcbiAgICBleHBlY3RJbnQodmFsdWU6IG51bWJlciB8IGJpZ2ludCk6IGJpZ2ludDtcbiAgICBleHBlY3RCdWZmKHZhbHVlOiBBcnJheUJ1ZmZlcik6IEFycmF5QnVmZmVyO1xuICAgIGV4cGVjdEFzY2lpKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmc7XG4gICAgZXhwZWN0VXRmOCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nO1xuICAgIGV4cGVjdFByaW5jaXBhbCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nO1xuICAgIGV4cGVjdExpc3QoKTogQXJyYXk8c3RyaW5nPjtcbiAgICBleHBlY3RUdXBsZSgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB9XG5cbiAgaW50ZXJmYWNlIEFycmF5PFQ+IHtcbiAgICBleHBlY3RTVFhUcmFuc2ZlckV2ZW50KFxuICAgICAgYW1vdW50OiBudW1iZXIgfCBiaWdpbnQsXG4gICAgICBzZW5kZXI6IHN0cmluZyxcbiAgICAgIHJlY2lwaWVudDogc3RyaW5nXG4gICAgKTogRXhwZWN0U1RYVHJhbnNmZXJFdmVudDtcbiAgICBleHBlY3RGdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudChcbiAgICAgIGFtb3VudDogbnVtYmVyIHwgYmlnaW50LFxuICAgICAgc2VuZGVyOiBzdHJpbmcsXG4gICAgICByZWNpcGllbnQ6IHN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IHN0cmluZ1xuICAgICk6IEV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50O1xuICAgIGV4cGVjdEZ1bmdpYmxlVG9rZW5NaW50RXZlbnQoXG4gICAgICBhbW91bnQ6IG51bWJlciB8IGJpZ2ludCxcbiAgICAgIHJlY2lwaWVudDogc3RyaW5nLFxuICAgICAgYXNzZXRJZDogc3RyaW5nXG4gICAgKTogRXhwZWN0RnVuZ2libGVUb2tlbk1pbnRFdmVudDtcbiAgICBleHBlY3RGdW5naWJsZVRva2VuQnVybkV2ZW50KFxuICAgICAgYW1vdW50OiBudW1iZXIgfCBiaWdpbnQsXG4gICAgICBzZW5kZXI6IHN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IHN0cmluZ1xuICAgICk6IEV4cGVjdEZ1bmdpYmxlVG9rZW5CdXJuRXZlbnQ7XG4gICAgZXhwZWN0UHJpbnRFdmVudChcbiAgICAgIGNvbnRyYWN0SWRlbnRpZmllcjogc3RyaW5nLFxuICAgICAgdmFsdWU6IHN0cmluZ1xuICAgICk6IEV4cGVjdFByaW50RXZlbnQ7XG4gICAgZXhwZWN0Tm9uRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQoXG4gICAgICB0b2tlbklkOiBzdHJpbmcsXG4gICAgICBzZW5kZXI6IHN0cmluZyxcbiAgICAgIHJlY2lwaWVudDogc3RyaW5nLFxuICAgICAgYXNzZXRBZGRyZXNzOiBzdHJpbmcsXG4gICAgICBhc3NldElkOiBzdHJpbmdcbiAgICApOiBFeHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudDtcbiAgICBleHBlY3ROb25GdW5naWJsZVRva2VuTWludEV2ZW50KFxuICAgICAgdG9rZW5JZDogc3RyaW5nLFxuICAgICAgcmVjaXBpZW50OiBzdHJpbmcsXG4gICAgICBhc3NldEFkZHJlc3M6IHN0cmluZyxcbiAgICAgIGFzc2V0SWQ6IHN0cmluZ1xuICAgICk6IEV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQ7XG4gICAgZXhwZWN0Tm9uRnVuZ2libGVUb2tlbkJ1cm5FdmVudChcbiAgICAgIHRva2VuSWQ6IHN0cmluZyxcbiAgICAgIHNlbmRlcjogc3RyaW5nLFxuICAgICAgYXNzZXRBZGRyZXNzOiBzdHJpbmcsXG4gICAgICBhc3NldElkOiBzdHJpbmdcbiAgICApOiBFeHBlY3ROb25GdW5naWJsZVRva2VuQnVybkV2ZW50O1xuICB9XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG5mdW5jdGlvbiBjb25zdW1lKHNyYzogU3RyaW5nLCBleHBlY3RhdGlvbjogc3RyaW5nLCB3cmFwcGVkOiBib29sZWFuKSB7XG4gIGxldCBkc3QgPSAoXCIgXCIgKyBzcmMpLnNsaWNlKDEpO1xuICBsZXQgc2l6ZSA9IGV4cGVjdGF0aW9uLmxlbmd0aDtcbiAgaWYgKCF3cmFwcGVkICYmIHNyYyAhPT0gZXhwZWN0YXRpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihleHBlY3RhdGlvbi50b1N0cmluZygpKX0sIGdvdCAke3JlZChzcmMudG9TdHJpbmcoKSl9YFxuICAgICk7XG4gIH1cbiAgaWYgKHdyYXBwZWQpIHtcbiAgICBzaXplICs9IDI7XG4gIH1cbiAgaWYgKGRzdC5sZW5ndGggPCBzaXplKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWBcbiAgICApO1xuICB9XG4gIGlmICh3cmFwcGVkKSB7XG4gICAgZHN0ID0gZHN0LnN1YnN0cmluZygxLCBkc3QubGVuZ3RoIC0gMSk7XG4gIH1cbiAgY29uc3QgcmVzID0gZHN0LnNsaWNlKDAsIGV4cGVjdGF0aW9uLmxlbmd0aCk7XG4gIGlmIChyZXMgIT09IGV4cGVjdGF0aW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oZXhwZWN0YXRpb24udG9TdHJpbmcoKSl9LCBnb3QgJHtyZWQoc3JjLnRvU3RyaW5nKCkpfWBcbiAgICApO1xuICB9XG4gIGxldCBsZWZ0UGFkID0gMDtcbiAgaWYgKGRzdC5jaGFyQXQoZXhwZWN0YXRpb24ubGVuZ3RoKSA9PT0gXCIgXCIpIHtcbiAgICBsZWZ0UGFkID0gMTtcbiAgfVxuICBjb25zdCByZW1haW5kZXIgPSBkc3Quc3Vic3RyaW5nKGV4cGVjdGF0aW9uLmxlbmd0aCArIGxlZnRQYWQpO1xuICByZXR1cm4gcmVtYWluZGVyO1xufVxuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdE9rID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gY29uc3VtZSh0aGlzLCBcIm9rXCIsIHRydWUpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RFcnIgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwiZXJyXCIsIHRydWUpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RTb21lID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gY29uc3VtZSh0aGlzLCBcInNvbWVcIiwgdHJ1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdE5vbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb25zdW1lKHRoaXMsIFwibm9uZVwiLCBmYWxzZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEJvb2wgPSBmdW5jdGlvbiAodmFsdWU6IGJvb2xlYW4pIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFVpbnQgPSBmdW5jdGlvbiAodmFsdWU6IG51bWJlciB8IGJpZ2ludCk6IGJpZ2ludCB7XG4gIHRyeSB7XG4gICAgY29uc3VtZSh0aGlzLCBgdSR7dmFsdWV9YCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiBCaWdJbnQodmFsdWUpO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RJbnQgPSBmdW5jdGlvbiAodmFsdWU6IG51bWJlciB8IGJpZ2ludCk6IGJpZ2ludCB7XG4gIHRyeSB7XG4gICAgY29uc3VtZSh0aGlzLCBgJHt2YWx1ZX1gLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIEJpZ0ludCh2YWx1ZSk7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEJ1ZmYgPSBmdW5jdGlvbiAodmFsdWU6IEFycmF5QnVmZmVyKSB7XG4gIGNvbnN0IGJ1ZmZlciA9IHR5cGVzLmJ1ZmYodmFsdWUpO1xuICBpZiAodGhpcyAhPT0gYnVmZmVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2dyZWVuKGJ1ZmZlcil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdEFzY2lpID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGBcIiR7dmFsdWV9XCJgLCBmYWxzZSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuU3RyaW5nLnByb3RvdHlwZS5leHBlY3RVdGY4ID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGB1XCIke3ZhbHVlfVwiYCwgZmFsc2UpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IGVycm9yO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cblN0cmluZy5wcm90b3R5cGUuZXhwZWN0UHJpbmNpcGFsID0gZnVuY3Rpb24gKHZhbHVlOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdW1lKHRoaXMsIGAke3ZhbHVlfWAsIGZhbHNlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdExpc3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmNoYXJBdCgwKSAhPT0gXCJbXCIgfHwgdGhpcy5jaGFyQXQodGhpcy5sZW5ndGggLSAxKSAhPT0gXCJdXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgJHtncmVlbihcIihsaXN0IC4uLilcIil9LCBnb3QgJHtyZWQodGhpcy50b1N0cmluZygpKX1gXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHN0YWNrID0gW107XG4gIGNvbnN0IGVsZW1lbnRzID0gW107XG4gIGxldCBzdGFydCA9IDE7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCIsXCIgJiYgc3RhY2subGVuZ3RoID09IDEpIHtcbiAgICAgIGVsZW1lbnRzLnB1c2godGhpcy5zdWJzdHJpbmcoc3RhcnQsIGkpKTtcbiAgICAgIHN0YXJ0ID0gaSArIDI7XG4gICAgfVxuICAgIGlmIChbXCIoXCIsIFwiW1wiLCBcIntcIl0uaW5jbHVkZXModGhpcy5jaGFyQXQoaSkpKSB7XG4gICAgICBzdGFjay5wdXNoKHRoaXMuY2hhckF0KGkpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIilcIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCIoXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwifVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIntcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJdXCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwiW1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgcmVtYWluZGVyID0gdGhpcy5zdWJzdHJpbmcoc3RhcnQsIHRoaXMubGVuZ3RoIC0gMSk7XG4gIGlmIChyZW1haW5kZXIubGVuZ3RoID4gMCkge1xuICAgIGVsZW1lbnRzLnB1c2gocmVtYWluZGVyKTtcbiAgfVxuICByZXR1cm4gZWxlbWVudHM7XG59O1xuXG5TdHJpbmcucHJvdG90eXBlLmV4cGVjdFR1cGxlID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5jaGFyQXQoMCkgIT09IFwie1wiIHx8IHRoaXMuY2hhckF0KHRoaXMubGVuZ3RoIC0gMSkgIT09IFwifVwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEV4cGVjdGVkICR7Z3JlZW4oXCIodHVwbGUgLi4uKVwiKX0sIGdvdCAke3JlZCh0aGlzLnRvU3RyaW5nKCkpfWBcbiAgICApO1xuICB9XG5cbiAgbGV0IHN0YXJ0ID0gMTtcbiAgY29uc3Qgc3RhY2sgPSBbXTtcbiAgY29uc3QgZWxlbWVudHMgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIixcIiAmJiBzdGFjay5sZW5ndGggPT0gMSkge1xuICAgICAgZWxlbWVudHMucHVzaCh0aGlzLnN1YnN0cmluZyhzdGFydCwgaSkpO1xuICAgICAgc3RhcnQgPSBpICsgMjtcbiAgICB9XG4gICAgaWYgKFtcIihcIiwgXCJbXCIsIFwie1wiXS5pbmNsdWRlcyh0aGlzLmNoYXJBdChpKSkpIHtcbiAgICAgIHN0YWNrLnB1c2godGhpcy5jaGFyQXQoaSkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5jaGFyQXQoaSkgPT09IFwiKVwiICYmIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdID09PSBcIihcIikge1xuICAgICAgc3RhY2sucG9wKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmNoYXJBdChpKSA9PT0gXCJ9XCIgJiYgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0gPT09IFwie1wiKSB7XG4gICAgICBzdGFjay5wb3AoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2hhckF0KGkpID09PSBcIl1cIiAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gXCJbXCIpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgIH1cbiAgfVxuICBjb25zdCByZW1haW5kZXIgPSB0aGlzLnN1YnN0cmluZyhzdGFydCwgdGhpcy5sZW5ndGggLSAxKTtcbiAgaWYgKHJlbWFpbmRlci5sZW5ndGggPiAwKSB7XG4gICAgZWxlbWVudHMucHVzaChyZW1haW5kZXIpO1xuICB9XG5cbiAgY29uc3QgdHVwbGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZWxlbWVudC5jaGFyQXQoaSkgPT09IFwiOlwiKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IGVsZW1lbnQuc3Vic3RyaW5nKDAsIGkpLnRyaW0oKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBlbGVtZW50LnN1YnN0cmluZyhpICsgMikudHJpbSgpO1xuICAgICAgICB0dXBsZVtrZXldID0gdmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0dXBsZTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RTVFhUcmFuc2ZlckV2ZW50ID0gZnVuY3Rpb24gKGFtb3VudCwgc2VuZGVyLCByZWNpcGllbnQpIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgc3R4X3RyYW5zZmVyX2V2ZW50IH0gPSBldmVudDtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFtb3VudDogc3R4X3RyYW5zZmVyX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KSxcbiAgICAgICAgc2VuZGVyOiBzdHhfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpLFxuICAgICAgICByZWNpcGllbnQ6IHN0eF90cmFuc2Zlcl9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCksXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byByZXRyaWV2ZSBleHBlY3RlZCBTVFhUcmFuc2ZlckV2ZW50XCIpO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdEZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50ID0gZnVuY3Rpb24gKFxuICBhbW91bnQsXG4gIHNlbmRlcixcbiAgcmVjaXBpZW50LFxuICBhc3NldElkXG4pIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgZnRfdHJhbnNmZXJfZXZlbnQgfSA9IGV2ZW50O1xuICAgICAgaWYgKCFmdF90cmFuc2Zlcl9ldmVudC5hc3NldF9pZGVudGlmaWVyLmVuZHNXaXRoKGFzc2V0SWQpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYW1vdW50OiBmdF90cmFuc2Zlcl9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCksXG4gICAgICAgIHNlbmRlcjogZnRfdHJhbnNmZXJfZXZlbnQuc2VuZGVyLmV4cGVjdFByaW5jaXBhbChzZW5kZXIpLFxuICAgICAgICByZWNpcGllbnQ6IGZ0X3RyYW5zZmVyX2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwocmVjaXBpZW50KSxcbiAgICAgICAgYXNzZXRJZDogZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlblRyYW5zZmVyRXZlbnQoJHthbW91bnR9LCAke3NlbmRlcn0sICR7cmVjaXBpZW50fSwgJHthc3NldElkfSlcXG4ke0pTT04uc3RyaW5naWZ5KFxuICAgICAgdGhpc1xuICAgICl9YFxuICApO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdEZ1bmdpYmxlVG9rZW5NaW50RXZlbnQgPSBmdW5jdGlvbiAoXG4gIGFtb3VudCxcbiAgcmVjaXBpZW50LFxuICBhc3NldElkXG4pIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgZnRfbWludF9ldmVudCB9ID0gZXZlbnQ7XG4gICAgICBpZiAoIWZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllci5lbmRzV2l0aChhc3NldElkKSkgY29udGludWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFtb3VudDogZnRfbWludF9ldmVudC5hbW91bnQuZXhwZWN0SW50KGFtb3VudCksXG4gICAgICAgIHJlY2lwaWVudDogZnRfbWludF9ldmVudC5yZWNpcGllbnQuZXhwZWN0UHJpbmNpcGFsKHJlY2lwaWVudCksXG4gICAgICAgIGFzc2V0SWQ6IGZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIEZ1bmdpYmxlVG9rZW5NaW50RXZlbnRcIik7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0RnVuZ2libGVUb2tlbkJ1cm5FdmVudCA9IGZ1bmN0aW9uIChcbiAgYW1vdW50LFxuICBzZW5kZXIsXG4gIGFzc2V0SWRcbikge1xuICBmb3IgKGNvbnN0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBmdF9idXJuX2V2ZW50IH0gPSBldmVudDtcbiAgICAgIGlmICghZnRfYnVybl9ldmVudC5hc3NldF9pZGVudGlmaWVyLmVuZHNXaXRoKGFzc2V0SWQpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYW1vdW50OiBmdF9idXJuX2V2ZW50LmFtb3VudC5leHBlY3RJbnQoYW1vdW50KSxcbiAgICAgICAgc2VuZGVyOiBmdF9idXJuX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKSxcbiAgICAgICAgYXNzZXRJZDogZnRfYnVybl9ldmVudC5hc3NldF9pZGVudGlmaWVyLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgRnVuZ2libGVUb2tlbkJ1cm5FdmVudFwiKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3RQcmludEV2ZW50ID0gZnVuY3Rpb24gKGNvbnRyYWN0SWRlbnRpZmllciwgdmFsdWUpIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgY29udHJhY3RfZXZlbnQgfSA9IGV2ZW50O1xuICAgICAgaWYgKCFjb250cmFjdF9ldmVudC50b3BpYy5lbmRzV2l0aChcInByaW50XCIpKSBjb250aW51ZTtcbiAgICAgIGlmICghY29udHJhY3RfZXZlbnQudmFsdWUuZW5kc1dpdGgodmFsdWUpKSBjb250aW51ZTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udHJhY3RfaWRlbnRpZmllcjpcbiAgICAgICAgICBjb250cmFjdF9ldmVudC5jb250cmFjdF9pZGVudGlmaWVyLmV4cGVjdFByaW5jaXBhbChcbiAgICAgICAgICAgIGNvbnRyYWN0SWRlbnRpZmllclxuICAgICAgICAgICksXG4gICAgICAgIHRvcGljOiBjb250cmFjdF9ldmVudC50b3BpYyxcbiAgICAgICAgdmFsdWU6IGNvbnRyYWN0X2V2ZW50LnZhbHVlLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGVycm9yKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmV0cmlldmUgZXhwZWN0ZWQgUHJpbnRFdmVudFwiKTtcbn07XG5cbkFycmF5LnByb3RvdHlwZS5leHBlY3ROb25GdW5naWJsZVRva2VuVHJhbnNmZXJFdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZCxcbiAgc2VuZGVyLFxuICByZWNpcGllbnQsXG4gIGFzc2V0QWRkcmVzcyxcbiAgYXNzZXRJZFxuKSB7XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgdGhpcykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IG5mdF90cmFuc2Zlcl9ldmVudCB9ID0gZXZlbnQ7XG4gICAgICBpZiAobmZ0X3RyYW5zZmVyX2V2ZW50LnZhbHVlICE9PSB0b2tlbklkKSBjb250aW51ZTtcbiAgICAgIGlmIChuZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllciAhPT0gYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b2tlbklkOiBuZnRfdHJhbnNmZXJfZXZlbnQudmFsdWUsXG4gICAgICAgIHNlbmRlcjogbmZ0X3RyYW5zZmVyX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKSxcbiAgICAgICAgcmVjaXBpZW50OiBuZnRfdHJhbnNmZXJfZXZlbnQucmVjaXBpZW50LmV4cGVjdFByaW5jaXBhbChyZWNpcGllbnQpLFxuICAgICAgICBhc3NldElkOiBuZnRfdHJhbnNmZXJfZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5UcmFuc2ZlckV2ZW50XCIpO1xufTtcblxuQXJyYXkucHJvdG90eXBlLmV4cGVjdE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnQgPSBmdW5jdGlvbiAoXG4gIHRva2VuSWQsXG4gIHJlY2lwaWVudCxcbiAgYXNzZXRBZGRyZXNzLFxuICBhc3NldElkXG4pIHtcbiAgZm9yIChjb25zdCBldmVudCBvZiB0aGlzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgbmZ0X21pbnRfZXZlbnQgfSA9IGV2ZW50O1xuICAgICAgaWYgKG5mdF9taW50X2V2ZW50LnZhbHVlICE9PSB0b2tlbklkKSBjb250aW51ZTtcbiAgICAgIGlmIChuZnRfbWludF9ldmVudC5hc3NldF9pZGVudGlmaWVyICE9PSBgJHthc3NldEFkZHJlc3N9Ojoke2Fzc2V0SWR9YClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRva2VuSWQ6IG5mdF9taW50X2V2ZW50LnZhbHVlLFxuICAgICAgICByZWNpcGllbnQ6IG5mdF9taW50X2V2ZW50LnJlY2lwaWVudC5leHBlY3RQcmluY2lwYWwocmVjaXBpZW50KSxcbiAgICAgICAgYXNzZXRJZDogbmZ0X21pbnRfZXZlbnQuYXNzZXRfaWRlbnRpZmllcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5NaW50RXZlbnRcIik7XG59O1xuXG5BcnJheS5wcm90b3R5cGUuZXhwZWN0Tm9uRnVuZ2libGVUb2tlbkJ1cm5FdmVudCA9IGZ1bmN0aW9uIChcbiAgdG9rZW5JZCxcbiAgc2VuZGVyLFxuICBhc3NldEFkZHJlc3MsXG4gIGFzc2V0SWRcbikge1xuICBmb3IgKGNvbnN0IGV2ZW50IG9mIHRoaXMpIHtcbiAgICB0cnkge1xuICAgICAgaWYgKGV2ZW50Lm5mdF9idXJuX2V2ZW50LnZhbHVlICE9PSB0b2tlbklkKSBjb250aW51ZTtcbiAgICAgIGlmIChcbiAgICAgICAgZXZlbnQubmZ0X2J1cm5fZXZlbnQuYXNzZXRfaWRlbnRpZmllciAhPT0gYCR7YXNzZXRBZGRyZXNzfTo6JHthc3NldElkfWBcbiAgICAgIClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFzc2V0SWQ6IGV2ZW50Lm5mdF9idXJuX2V2ZW50LmFzc2V0X2lkZW50aWZpZXIsXG4gICAgICAgIHRva2VuSWQ6IGV2ZW50Lm5mdF9idXJuX2V2ZW50LnZhbHVlLFxuICAgICAgICBzZW5kZXI6IGV2ZW50Lm5mdF9idXJuX2V2ZW50LnNlbmRlci5leHBlY3RQcmluY2lwYWwoc2VuZGVyKSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoX2Vycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJldHJpZXZlIGV4cGVjdGVkIE5vbkZ1bmdpYmxlVG9rZW5CdXJuRXZlbnRcIik7XG59O1xuXG5jb25zdCBub0NvbG9yID0gRGVuby5ub0NvbG9yID8/IHRydWU7XG5jb25zdCBlbmFibGVkID0gIW5vQ29sb3I7XG5cbmludGVyZmFjZSBDb2RlIHtcbiAgb3Blbjogc3RyaW5nO1xuICBjbG9zZTogc3RyaW5nO1xuICByZWdleHA6IFJlZ0V4cDtcbn1cblxuZnVuY3Rpb24gY29kZShvcGVuOiBudW1iZXJbXSwgY2xvc2U6IG51bWJlcik6IENvZGUge1xuICByZXR1cm4ge1xuICAgIG9wZW46IGBcXHgxYlske29wZW4uam9pbihcIjtcIil9bWAsXG4gICAgY2xvc2U6IGBcXHgxYlske2Nsb3NlfW1gLFxuICAgIHJlZ2V4cDogbmV3IFJlZ0V4cChgXFxcXHgxYlxcXFxbJHtjbG9zZX1tYCwgXCJnXCIpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBydW4oc3RyOiBzdHJpbmcsIGNvZGU6IENvZGUpOiBzdHJpbmcge1xuICByZXR1cm4gZW5hYmxlZFxuICAgID8gYCR7Y29kZS5vcGVufSR7c3RyLnJlcGxhY2UoY29kZS5yZWdleHAsIGNvZGUub3Blbil9JHtjb2RlLmNsb3NlfWBcbiAgICA6IHN0cjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZChzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBydW4oc3RyLCBjb2RlKFszMV0sIDM5KSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBncmVlbihzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBydW4oc3RyLCBjb2RlKFszMl0sIDM5KSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBYUEsY0FBYyxZQUFZLENBQUM7QUFFM0IsT0FBTyxNQUFNLEVBQUU7SUFDYixJQUFJLENBQVM7SUFDYixNQUFNLENBQVM7SUFDZixZQUFZLENBQWtCO0lBQzlCLFdBQVcsQ0FBYztJQUN6QixjQUFjLENBQW9CO0lBRWxDLFlBQVksSUFBWSxFQUFFLE1BQWMsQ0FBRTtRQUN4QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN0QjtJQUVELE9BQU8sV0FBVyxDQUFDLE1BQWMsRUFBRSxTQUFpQixFQUFFLE1BQWMsRUFBRTtRQUNwRSxNQUFNLEVB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QyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUMvRCxDQUFDO0tBQ0g7SUFFRCxNQUFNLEtBQUssR0FBRyxFQUFFLEFBQUM7SUFDakIsTUFBTSxRQUFRLEdBQUcsRUFBRSxBQUFDO0lBQ3BCLElBQUksS0FBSyxHQUFHLENBQUMsQUFBQztJQUNkLElBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFFO1FBQ3BDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDL0MsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2Y7UUFDRCxJQUFJO1lBQUMsR0FBRztZQUFFLEdBQUc7WUFBRSxHQUFHO1NBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzVDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzVCO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDN0QsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ2I7UUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUM3RCxLQUFLLENBQUMsR0FB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